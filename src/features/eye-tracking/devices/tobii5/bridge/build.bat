@echo off
REM Build script for Tobii Bridge Server on Windows
REM Automatically downloads dependencies and builds the executable

echo.
echo Synopticon Tobii Bridge Server - Build Script
echo ============================================
echo.

REM Create build directory
if not exist "build" mkdir build
cd build

REM Check if CMake is available
cmake --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: CMake is not installed or not in PATH
    echo Please install CMake from https://cmake.org/download/
    pause
    exit /b 1
)

REM Check if Visual Studio is available
where cl >nul 2>&1
if errorlevel 1 (
    echo Setting up Visual Studio environment...
    call "C:\Program Files (x86)\Microsoft Visual Studio\2019\Professional\VC\Auxiliary\Build\vcvars64.bat" 2>nul
    if errorlevel 1 (
        call "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat" 2>nul
        if errorlevel 1 (
            echo ERROR: Visual Studio compiler not found
            echo Please install Visual Studio with C++ support
            pause
            exit /b 1
        )
    )
)

REM Download dependencies if they don't exist
if not exist "../third_party" (
    echo Downloading dependencies...
    cd ..
    mkdir third_party
    cd third_party
    
    echo Downloading websocketpp...
    git clone --depth 1 https://github.com/zaphoyd/websocketpp.git 2>nul || (
        echo WARNING: Failed to download websocketpp. Manual setup required.
    )
    
    echo Downloading asio...
    git clone --depth 1 https://github.com/chriskohlhoff/asio.git 2>nul || (
        echo WARNING: Failed to download asio. Manual setup required.
    )
    
    echo Downloading nlohmann/json...
    git clone --depth 1 https://github.com/nlohmann/json.git nlohmann_json 2>nul || (
        echo WARNING: Failed to download nlohmann/json. Manual setup required.
    )
    
    cd ../build
)

REM Configure with CMake
echo Configuring build...
cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 (
    echo ERROR: CMake configuration failed
    pause
    exit /b 1
)

REM Build
echo Building Tobii Bridge Server...
cmake --build . --config Release --target tobii_bridge
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

REM Create deployment package
echo Creating deployment package...
mkdir ..\deployment 2>nul
copy Release\tobii_bridge.exe ..\deployment\ 2>nul

REM Copy Tobii DLLs if they exist
if exist "C:\Program Files\Tobii\Tobii Game Integration\TobiiGameIntegration.dll" (
    copy "C:\Program Files\Tobii\Tobii Game Integration\TobiiGameIntegration.dll" ..\deployment\
    echo Tobii DLL copied to deployment folder
)

REM Create configuration file
echo Creating default configuration...
echo { > ..\deployment\config.json
echo   "websocket_port": 8080, >> ..\deployment\config.json
echo   "udp_port": 4242, >> ..\deployment\config.json
echo   "discovery_port": 8083, >> ..\deployment\config.json
echo   "log_level": "info" >> ..\deployment\config.json
echo } >> ..\deployment\config.json

REM Create install script
echo Creating install script...
echo @echo off > ..\deployment\install.bat
echo echo Starting Tobii Bridge Server... >> ..\deployment\install.bat
echo tobii_bridge.exe >> ..\deployment\install.bat
echo pause >> ..\deployment\install.bat

REM Create README
echo Creating documentation...
echo Synopticon Tobii Bridge Server > ..\deployment\README.txt
echo =============================== >> ..\deployment\README.txt
echo. >> ..\deployment\README.txt
echo This is a lightweight bridge server that connects Tobii Eye Tracker 5 >> ..\deployment\README.txt
echo to Synopticon running on remote computers. >> ..\deployment\README.txt
echo. >> ..\deployment\README.txt
echo Requirements: >> ..\deployment\README.txt
echo - Windows 10/11 >> ..\deployment\README.txt
echo - Tobii Eye Tracker 5 with Tobii Game Hub installed >> ..\deployment\README.txt
echo - Network connection to Synopticon master >> ..\deployment\README.txt
echo. >> ..\deployment\README.txt
echo Usage: >> ..\deployment\README.txt
echo 1. Double-click install.bat to start the bridge server >> ..\deployment\README.txt
echo 2. Configure your Synopticon system to connect to this computer's IP >> ..\deployment\README.txt
echo 3. The server will be auto-discovered on the network >> ..\deployment\README.txt
echo. >> ..\deployment\README.txt
echo Ports used: >> ..\deployment\README.txt
echo - 8080: WebSocket (primary data) >> ..\deployment\README.txt
echo - 4242: UDP (OpenTrack compatibility) >> ..\deployment\README.txt
echo - 8083: UDP (auto-discovery) >> ..\deployment\README.txt

cd ..
echo.
echo ✅ Build completed successfully!
echo.
echo Deployment files created in: deployment\
echo - tobii_bridge.exe     (Main executable)
echo - config.json         (Configuration)
echo - install.bat         (Startup script)
echo - README.txt          (Documentation)
echo.
echo To deploy: Copy the 'deployment' folder to the Windows PC with Tobii 5
echo.
pause