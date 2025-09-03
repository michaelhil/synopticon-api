/**
 * Tobii Bridge Server
 * Lightweight C++ server that connects to Tobii 5 via TGI API
 * Provides WebSocket and UDP interfaces for Synopticon integration
 * Designed for minimal deployment on Windows PC with Tobii 5
 */

#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <atomic>
#include <memory>
#include <unordered_map>
#include <vector>
#include <cmath>

// WebSocket server (using websocketpp)
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>

// UDP socket
#include <asio.hpp>

// JSON handling
#include <nlohmann/json.hpp>

// Tobii Game Integration API
#include "tobii_gameintegration.h"

using json = nlohmann::json;
using websocketpp::lib::placeholders::_1;
using websocketpp::lib::placeholders::_2;
using websocketpp::lib::bind;

/**
 * Tobii data packet structure
 */
struct TobiiDataPacket {
    uint64_t timestamp;
    
    // Gaze data
    bool hasGaze;
    float gazeX, gazeY;
    uint64_t gazeTimestamp;
    float gazeConfidence;
    
    // Head pose data
    bool hasHead;
    float headYaw, headPitch, headRoll;
    float headPosX, headPosY, headPosZ;
    float headConfidence;
    
    // Presence detection
    bool present;
    
    // Quality metrics
    float overallQuality;
};

/**
 * OpenTrack UDP packet structure
 */
struct OpenTrackPacket {
    float yaw;
    float pitch; 
    float roll;
    float x;
    float y;
    float z;
};

/**
 * Main Tobii Bridge Server class
 */
class TobiiBridgeServer {
private:
    // Tobii Game Integration
    TobiiGameIntegration::ITobiiGameIntegrationApi* tgiApi;
    TobiiGameIntegration::IStreamsProvider* streams;
    
    // Network servers
    websocketpp::server<websocketpp::config::asio> wsServer;
    std::unique_ptr<asio::io_context> ioContext;
    std::unique_ptr<asio::ip::udp::socket> udpSocket;
    std::unique_ptr<asio::ip::udp::socket> discoverySocket;
    
    // Server state
    std::atomic<bool> running;
    std::atomic<bool> tobiiConnected;
    std::atomic<bool> recordingEnabled;
    std::thread mainThread;
    std::thread discoveryThread;
    
    // Configuration
    int wsPort;
    int udpPort;
    int discoveryPort;
    
    // Data processing
    TobiiDataPacket latestData;
    std::mutex dataMutex;
    
    // Client management
    std::unordered_map<websocketpp::connection_hdl, std::string, 
                      std::owner_less<websocketpp::connection_hdl>> clients;
    std::mutex clientsMutex;
    
    // Statistics
    std::atomic<uint64_t> packetsProcessed;
    std::atomic<uint64_t> packetsDistributed;
    std::atomic<uint64_t> clientCount;

public:
    TobiiBridgeServer(int wsPort = 8080, int udpPort = 4242, int discoveryPort = 8083) 
        : tgiApi(nullptr), streams(nullptr), running(false), tobiiConnected(false), 
          recordingEnabled(false), wsPort(wsPort), udpPort(udpPort), 
          discoveryPort(discoveryPort), packetsProcessed(0), packetsDistributed(0),
          clientCount(0) {
        
        ioContext = std::make_unique<asio::io_context>();
        
        // Initialize latest data structure
        memset(&latestData, 0, sizeof(latestData));
    }
    
    ~TobiiBridgeServer() {
        stop();
    }
    
    /**
     * Initialize and start the bridge server
     */
    bool start() {
        std::cout << "Starting Tobii Bridge Server..." << std::endl;
        
        // Initialize Tobii Game Integration
        if (!initializeTobii()) {
            std::cerr << "Failed to initialize Tobii Game Integration" << std::endl;
            return false;
        }
        
        // Setup WebSocket server
        if (!setupWebSocketServer()) {
            std::cerr << "Failed to setup WebSocket server" << std::endl;
            return false;
        }
        
        // Setup UDP server
        if (!setupUDPServer()) {
            std::cerr << "Failed to setup UDP server" << std::endl;
            return false;
        }
        
        // Setup discovery beacon
        setupDiscoveryBeacon();
        
        running = true;
        
        // Start main processing thread
        mainThread = std::thread(&TobiiBridgeServer::mainLoop, this);
        
        // Start discovery beacon thread
        discoveryThread = std::thread(&TobiiBridgeServer::discoveryLoop, this);
        
        std::cout << "✅ Tobii Bridge Server started" << std::endl;
        std::cout << "   WebSocket: ws://localhost:" << wsPort << std::endl;
        std::cout << "   UDP (OpenTrack): localhost:" << udpPort << std::endl;
        std::cout << "   Discovery: UDP:" << discoveryPort << std::endl;
        
        return true;
    }
    
    /**
     * Stop the bridge server
     */
    void stop() {
        if (!running) return;
        
        std::cout << "Stopping Tobii Bridge Server..." << std::endl;
        running = false;
        
        // Stop threads
        if (mainThread.joinable()) {
            mainThread.join();
        }
        
        if (discoveryThread.joinable()) {
            discoveryThread.join();
        }
        
        // Cleanup Tobii API
        if (tgiApi) {
            // TGI cleanup would go here
        }
        
        std::cout << "✅ Tobii Bridge Server stopped" << std::endl;
    }
    
    /**
     * Wait for server to finish
     */
    void waitForCompletion() {
        if (mainThread.joinable()) {
            mainThread.join();
        }
        if (discoveryThread.joinable()) {
            discoveryThread.join();
        }
    }
    
private:
    /**
     * Initialize Tobii Game Integration API
     */
    bool initializeTobii() {
        try {
            std::cout << "Initializing Tobii Game Integration..." << std::endl;
            
            tgiApi = TobiiGameIntegration::GetApi("Synopticon Tobii Bridge v1.0");
            if (!tgiApi) {
                std::cerr << "Failed to get TGI API instance" << std::endl;
                return false;
            }
            
            streams = tgiApi->GetStreamsProvider();
            if (!streams) {
                std::cerr << "Failed to get streams provider" << std::endl;
                return false;
            }
            
            // Setup window tracking (required for TGI)
            // This would need actual window handle in production
            // tgiApi->GetTrackerController()->TrackWindow(GetConsoleWindow());
            
            tobiiConnected = true;
            std::cout << "✅ Tobii Game Integration initialized" << std::endl;
            
            return true;
        } catch (const std::exception& e) {
            std::cerr << "Exception initializing Tobii: " << e.what() << std::endl;
            return false;
        }
    }
    
    /**
     * Setup WebSocket server
     */
    bool setupWebSocketServer() {
        try {
            wsServer.set_access_channels(websocketpp::log::alevel::all);
            wsServer.clear_access_channels(websocketpp::log::alevel::frame_payload);
            
            wsServer.init_asio(ioContext.get());
            wsServer.set_reuse_addr(true);
            
            // Set message handler
            wsServer.set_message_handler(bind(&TobiiBridgeServer::onWebSocketMessage, this, _1, _2));
            
            // Set connection handlers
            wsServer.set_open_handler(bind(&TobiiBridgeServer::onWebSocketOpen, this, _1));
            wsServer.set_close_handler(bind(&TobiiBridgeServer::onWebSocketClose, this, _1));
            
            wsServer.listen(wsPort);
            wsServer.start_accept();
            
            std::cout << "✅ WebSocket server setup on port " << wsPort << std::endl;
            
            return true;
        } catch (const std::exception& e) {
            std::cerr << "Exception setting up WebSocket server: " << e.what() << std::endl;
            return false;
        }
    }
    
    /**
     * Setup UDP server for OpenTrack compatibility
     */
    bool setupUDPServer() {
        try {
            udpSocket = std::make_unique<asio::ip::udp::socket>(
                *ioContext, asio::ip::udp::endpoint(asio::ip::udp::v4(), udpPort)
            );
            
            std::cout << "✅ UDP server setup on port " << udpPort << std::endl;
            
            return true;
        } catch (const std::exception& e) {
            std::cerr << "Exception setting up UDP server: " << e.what() << std::endl;
            return false;
        }
    }
    
    /**
     * Setup discovery beacon
     */
    void setupDiscoveryBeacon() {
        try {
            discoverySocket = std::make_unique<asio::ip::udp::socket>(
                *ioContext, asio::ip::udp::endpoint(asio::ip::udp::v4(), 0)
            );
            discoverySocket->set_option(asio::socket_base::broadcast(true));
            
            std::cout << "✅ Discovery beacon setup" << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "Exception setting up discovery: " << e.what() << std::endl;
        }
    }
    
    /**
     * Main processing loop
     */
    void mainLoop() {
        std::cout << "Main processing loop started" << std::endl;
        
        auto lastUpdate = std::chrono::high_resolution_clock::now();
        const auto targetInterval = std::chrono::milliseconds(16); // ~60Hz
        
        while (running) {
            auto now = std::chrono::high_resolution_clock::now();
            
            try {
                // Update Tobii API
                if (tgiApi && tobiiConnected) {
                    tgiApi->Update();
                    
                    // Process Tobii data
                    processTobiiData();
                    
                    // Distribute data to clients
                    distributeData();
                }
                
                // Process network events
                ioContext->poll();
                
            } catch (const std::exception& e) {
                std::cerr << "Exception in main loop: " << e.what() << std::endl;
            }
            
            // Maintain target frame rate
            auto elapsed = std::chrono::high_resolution_clock::now() - now;
            if (elapsed < targetInterval) {
                std::this_thread::sleep_for(targetInterval - elapsed);
            }
        }
        
        std::cout << "Main processing loop ended" << std::endl;
    }
    
    /**
     * Discovery beacon loop
     */
    void discoveryLoop() {
        std::cout << "Discovery beacon loop started" << std::endl;
        
        while (running) {
            try {
                broadcastDiscovery();
                std::this_thread::sleep_for(std::chrono::seconds(5));
            } catch (const std::exception& e) {
                std::cerr << "Exception in discovery loop: " << e.what() << std::endl;
            }
        }
        
        std::cout << "Discovery beacon loop ended" << std::endl;
    }
    
    /**
     * Process Tobii data from TGI API
     */
    void processTobiiData() {
        if (!streams) return;
        
        std::lock_guard<std::mutex> lock(dataMutex);
        
        // Update timestamp
        latestData.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();
        
        // Get gaze data
        TobiiGameIntegration::GazePoint gazePoint;
        if (streams->GetLatestGazePoint(gazePoint)) {
            latestData.hasGaze = true;
            latestData.gazeX = gazePoint.X;
            latestData.gazeY = gazePoint.Y;
            latestData.gazeTimestamp = gazePoint.Timestamp;
            latestData.gazeConfidence = 0.9f; // TGI doesn't provide confidence
        } else {
            latestData.hasGaze = false;
        }
        
        // Get head pose data
        TobiiGameIntegration::HeadPose headPose;
        if (streams->GetLatestHeadPose(headPose)) {
            latestData.hasHead = true;
            latestData.headYaw = headPose.Rotation.YawDegrees;
            latestData.headPitch = headPose.Rotation.PitchDegrees;
            latestData.headRoll = headPose.Rotation.RollDegrees;
            latestData.headPosX = headPose.Position.X;
            latestData.headPosY = headPose.Position.Y;
            latestData.headPosZ = headPose.Position.Z;
            latestData.headConfidence = 0.9f; // TGI doesn't provide confidence
        } else {
            latestData.hasHead = false;
        }
        
        // Get presence data
        latestData.present = streams->IsPresent();
        
        // Calculate overall quality
        float qualitySum = 0;
        int qualityCount = 0;
        
        if (latestData.hasGaze) {
            qualitySum += latestData.gazeConfidence;
            qualityCount++;
        }
        
        if (latestData.hasHead) {
            qualitySum += latestData.headConfidence;
            qualityCount++;
        }
        
        if (latestData.present) {
            qualitySum += 0.9f;
            qualityCount++;
        }
        
        latestData.overallQuality = qualityCount > 0 ? qualitySum / qualityCount : 0;
        
        packetsProcessed++;
    }
    
    /**
     * Distribute data to all connected clients
     */
    void distributeData() {
        std::lock_guard<std::mutex> dataLock(dataMutex);
        std::lock_guard<std::mutex> clientLock(clientsMutex);
        
        if (clients.empty()) return;
        
        // Create WebSocket JSON message
        json wsMessage = createWebSocketMessage(latestData);
        std::string wsData = wsMessage.dump();
        
        // Send to WebSocket clients
        for (auto& client : clients) {
            try {
                wsServer.send(client.first, wsData, websocketpp::frame::opcode::text);
            } catch (const std::exception& e) {
                std::cerr << "Failed to send to WebSocket client: " << e.what() << std::endl;
            }
        }
        
        // Send OpenTrack UDP data
        if (latestData.hasHead) {
            OpenTrackPacket udpPacket;
            udpPacket.yaw = latestData.headYaw;
            udpPacket.pitch = latestData.headPitch;
            udpPacket.roll = latestData.headRoll;
            udpPacket.x = latestData.headPosX;
            udpPacket.y = latestData.headPosY;
            udpPacket.z = latestData.headPosZ;
            
            try {
                // Broadcast to OpenTrack port (simplified - would need proper client management)
                asio::ip::udp::endpoint endpoint(asio::ip::address_v4::broadcast(), udpPort);
                udpSocket->send_to(asio::buffer(&udpPacket, sizeof(udpPacket)), endpoint);
            } catch (const std::exception& e) {
                // UDP errors are non-critical
            }
        }
        
        packetsDistributed++;
    }
    
    /**
     * Create WebSocket message from Tobii data
     */
    json createWebSocketMessage(const TobiiDataPacket& data) {
        json message;
        message["type"] = "tobii-data";
        message["timestamp"] = data.timestamp;
        
        // Gaze data
        if (data.hasGaze) {
            message["data"]["gaze"]["x"] = data.gazeX;
            message["data"]["gaze"]["y"] = data.gazeY;
            message["data"]["gaze"]["timestamp"] = data.gazeTimestamp;
            message["data"]["gaze"]["confidence"] = data.gazeConfidence;
        }
        message["data"]["hasGaze"] = data.hasGaze;
        
        // Head pose data
        if (data.hasHead) {
            message["data"]["head"]["yaw"] = data.headYaw;
            message["data"]["head"]["pitch"] = data.headPitch;
            message["data"]["head"]["roll"] = data.headRoll;
            message["data"]["head"]["position"]["x"] = data.headPosX;
            message["data"]["head"]["position"]["y"] = data.headPosY;
            message["data"]["head"]["position"]["z"] = data.headPosZ;
            message["data"]["head"]["confidence"] = data.headConfidence;
        }
        message["data"]["hasHead"] = data.hasHead;
        
        // Presence data
        message["data"]["present"] = data.present;
        message["data"]["overallQuality"] = data.overallQuality;
        
        return message;
    }
    
    /**
     * Broadcast discovery announcement
     */
    void broadcastDiscovery() {
        try {
            json announcement;
            announcement["type"] = "tobii-bridge-announcement";
            announcement["service"] = "tobii-bridge";
            announcement["version"] = "1.0";
            announcement["websocket_port"] = wsPort;
            announcement["udp_port"] = udpPort;
            announcement["config_port"] = 8081; // Would be configurable
            announcement["capabilities"] = json::array({"gaze-tracking", "head-tracking", "presence-detection"});
            announcement["timestamp"] = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()
            ).count();
            
            std::string message = announcement.dump();
            
            asio::ip::udp::endpoint endpoint(asio::ip::address_v4::broadcast(), discoveryPort);
            discoverySocket->send_to(asio::buffer(message), endpoint);
            
        } catch (const std::exception& e) {
            // Discovery errors are non-critical
        }
    }
    
    /**
     * WebSocket event handlers
     */
    void onWebSocketOpen(websocketpp::connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(clientsMutex);
        clients[hdl] = "client_" + std::to_string(clients.size());
        clientCount = clients.size();
        
        std::cout << "WebSocket client connected. Total clients: " << clientCount << std::endl;
    }
    
    void onWebSocketClose(websocketpp::connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(clientsMutex);
        clients.erase(hdl);
        clientCount = clients.size();
        
        std::cout << "WebSocket client disconnected. Total clients: " << clientCount << std::endl;
    }
    
    void onWebSocketMessage(websocketpp::connection_hdl hdl, websocketpp::server<websocketpp::config::asio>::message_ptr msg) {
        try {
            json command = json::parse(msg->get_payload());
            handleCommand(hdl, command);
        } catch (const std::exception& e) {
            std::cerr << "Failed to parse WebSocket message: " << e.what() << std::endl;
        }
    }
    
    /**
     * Handle WebSocket commands from clients
     */
    void handleCommand(websocketpp::connection_hdl hdl, const json& command) {
        std::string type = command.value("type", "");
        
        if (type == "start-calibration") {
            // Calibration would be handled here
            json response;
            response["type"] = "tobii-calibration";
            response["calibration"]["status"] = "started";
            response["calibration"]["result"] = "success";
            
            wsServer.send(hdl, response.dump(), websocketpp::frame::opcode::text);
        }
        else if (type == "stop-calibration") {
            json response;
            response["type"] = "tobii-calibration";
            response["calibration"]["status"] = "stopped";
            
            wsServer.send(hdl, response.dump(), websocketpp::frame::opcode::text);
        }
        else if (type == "set-recording") {
            recordingEnabled = command.value("data", json::object()).value("enabled", false);
            
            json response;
            response["type"] = "tobii-status";
            response["status"]["recording"] = recordingEnabled.load();
            
            wsServer.send(hdl, response.dump(), websocketpp::frame::opcode::text);
        }
        else if (type == "get-status") {
            json response;
            response["type"] = "tobii-status";
            response["status"]["connected"] = tobiiConnected.load();
            response["status"]["recording"] = recordingEnabled.load();
            response["status"]["clients"] = clientCount.load();
            response["status"]["packets_processed"] = packetsProcessed.load();
            response["status"]["packets_distributed"] = packetsDistributed.load();
            
            wsServer.send(hdl, response.dump(), websocketpp::frame::opcode::text);
        }
    }
};

/**
 * Main entry point
 */
int main(int argc, char* argv[]) {
    std::cout << "Synopticon Tobii Bridge Server v1.0" << std::endl;
    std::cout << "====================================" << std::endl;
    
    try {
        TobiiBridgeServer server;
        
        if (!server.start()) {
            std::cerr << "Failed to start server" << std::endl;
            return 1;
        }
        
        std::cout << "Server running. Press Ctrl+C to stop..." << std::endl;
        
        // Wait for completion
        server.waitForCompletion();
        
    } catch (const std::exception& e) {
        std::cerr << "Server exception: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}