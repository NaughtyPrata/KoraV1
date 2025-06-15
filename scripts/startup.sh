#!/bin/bash

echo "🚀 Starting NLB Talking Avatar Server..."
echo "=================================="

# Function to kill processes on port 7471
kill_port_7471() {
    echo "🔍 Checking for processes on port 7471..."
    
    # Find and kill processes using port 7471
    PIDS=$(lsof -ti:7471)
    
    if [ ! -z "$PIDS" ]; then
        echo "💀 Found processes on port 7471: $PIDS"
        echo "🔫 Killing processes..."
        
        # Try graceful kill first
        kill $PIDS 2>/dev/null
        sleep 2
        
        # Check if still running and force kill
        REMAINING=$(lsof -ti:7471)
        if [ ! -z "$REMAINING" ]; then
            echo "🔨 Force killing remaining processes..."
            kill -9 $REMAINING 2>/dev/null
            sleep 1
        fi
        
        echo "✅ Port 7471 cleared!"
    else
        echo "✅ Port 7471 is already free!"
    fi
}

# Function to kill any Next.js dev processes
kill_nextjs_processes() {
    echo "🔍 Checking for Next.js processes..."
    
    # Kill any running Next.js dev processes
    pkill -f "next dev" 2>/dev/null
    pkill -f "next-dev" 2>/dev/null
    pkill -f "node.*next" 2>/dev/null
    
    sleep 1
    echo "✅ Next.js processes cleared!"
}

# Main execution
echo "🧹 Cleaning up existing processes..."
kill_nextjs_processes
kill_port_7471

echo ""
echo "🎯 Starting server on port 7471..."
echo "📍 URL: http://localhost:7471"
echo "🌐 Network: http://$(ipconfig getifaddr en0):7471"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================="

# Start the development server
npm run dev 