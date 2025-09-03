# CMakeLists.txt for Tobii Bridge Server
# Minimal build configuration for lightweight Windows deployment

cmake_minimum_required(VERSION 3.16)

project(TobiiBridgeServer VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Compiler flags
if(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2")
else()
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")
endif()

# Find packages
find_package(Threads REQUIRED)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/websocketpp
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/asio/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/nlohmann_json/include
)

# Tobii Game Integration SDK
if(WIN32)
    # Windows-specific Tobii SDK paths
    set(TOBII_SDK_PATH "C:/Program Files/Tobii/Tobii Game Integration/SDK" CACHE PATH "Path to Tobii SDK")
    
    include_directories("${TOBII_SDK_PATH}/include")
    
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        # 64-bit
        link_directories("${TOBII_SDK_PATH}/lib/x64")
    else()
        # 32-bit
        link_directories("${TOBII_SDK_PATH}/lib/x86")
    endif()
    
    set(TOBII_LIBRARIES TobiiGameIntegration)
else()
    message(WARNING "Tobii SDK is only available on Windows. Building without Tobii support.")
    set(TOBII_LIBRARIES)
endif()

# Define preprocessor macros
if(WIN32)
    add_definitions(-DWIN32_LEAN_AND_MEAN)
    add_definitions(-D_WIN32_WINNT=0x0601)  # Windows 7+
endif()

# Source files
set(SOURCES
    tobii-bridge-server.cpp
)

# Create executable
add_executable(tobii_bridge ${SOURCES})

# Link libraries
target_link_libraries(tobii_bridge 
    PRIVATE 
    ${CMAKE_THREAD_LIBS_INIT}
    ${TOBII_LIBRARIES}
)

# Windows-specific libraries
if(WIN32)
    target_link_libraries(tobii_bridge PRIVATE ws2_32 wsock32)
endif()

# Compiler-specific options
if(MSVC)
    target_compile_definitions(tobii_bridge PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

# Installation
install(TARGETS tobii_bridge
    RUNTIME DESTINATION bin
    COMPONENT runtime
)

# Package configuration
set(CPACK_PACKAGE_NAME "TobiiBridgeServer")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Lightweight Tobii 5 bridge for Synopticon")
set(CPACK_PACKAGE_VENDOR "Synopticon")

if(WIN32)
    set(CPACK_GENERATOR "ZIP")
else()
    set(CPACK_GENERATOR "TGZ")
endif()

include(CPack)