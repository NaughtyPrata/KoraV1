import React, { useState, useCallback } from 'react';
import Head from 'next/head';

export default function SimpleVoiceTest() {
  const [status, setStatus] = useState('Ready');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev.slice(-20), logMessage]);
  }, []);

  const testMicrophone = useCallback(async () => {
    try {
      setStatus('Testing microphone access...');
      addLog('Testing microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      addLog('✅ Microphone access granted');
      setStatus('Microphone OK');
      
      // Test audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      addLog(`✅ AudioContext created: ${audioContext.state}`);
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      
    } catch (error) {
      addLog(`❌ Microphone error: ${error}`);
      setStatus(`Microphone Error: ${error}`);
    }
  }, [addLog]);

  const testGladiaAPI = useCallback(async () => {
    try {
      setStatus('Testing Gladia API...');
      addLog('Testing Gladia API...');
      
      const apiKey = process.env.NEXT_PUBLIC_GLADIA_API_KEY || '42f4192e-55d4-4a27-830a-d62c2cb32c03';
      addLog(`Using API key: ${apiKey?.substring(0, 10)}...`);
      
      const config = {
        encoding: 'wav/pcm',
        sample_rate: 16000,
        bit_depth: 16,
        channels: 1,
        language_config: {
          languages: ['en']
        }
      };

      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gladia-Key': apiKey
        },
        body: JSON.stringify(config)
      });

      addLog(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      const session = await response.json();
      addLog(`✅ Session created: ${session.id}`);
      addLog(`WebSocket URL: ${session.url}`);
      setStatus('Gladia API OK');
      
    } catch (error) {
      addLog(`❌ Gladia API error: ${error}`);
      setStatus(`API Error: ${error}`);
    }
  }, [addLog]);

  const testWebSocket = useCallback(async () => {
    try {
      setStatus('Testing WebSocket...');
      addLog('Testing WebSocket connection...');
      
      // First get a session
      const apiKey = process.env.NEXT_PUBLIC_GLADIA_API_KEY || '42f4192e-55d4-4a27-830a-d62c2cb32c03';
      const config = {
        encoding: 'wav/pcm',
        sample_rate: 16000,
        bit_depth: 16,
        channels: 1
      };

      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gladia-Key': apiKey
        },
        body: JSON.stringify(config)
      });

      const session = await response.json();
      addLog(`Connecting to: ${session.url}`);
      
      const ws = new WebSocket(session.url);
      
      ws.onopen = () => {
        addLog('✅ WebSocket connected');
        setStatus('WebSocket OK');
        ws.close();
      };
      
      ws.onerror = (error) => {
        addLog(`❌ WebSocket error: ${error}`);
        setStatus(`WebSocket Error: ${error}`);
      };
      
      ws.onclose = (event) => {
        addLog(`WebSocket closed: ${event.code} ${event.reason}`);
      };
      
    } catch (error) {
      addLog(`❌ WebSocket test error: ${error}`);
      setStatus(`WebSocket Error: ${error}`);
    }
  }, [addLog]);

  const runAllTests = useCallback(async () => {
    setLogs([]);
    addLog('🧪 Starting diagnostic tests...');
    
    await testMicrophone();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGladiaAPI();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testWebSocket();
    
    addLog('🏁 All tests completed');
    setStatus('Tests completed');
  }, [testMicrophone, testGladiaAPI, testWebSocket, addLog]);

  return (
    <>
      <Head>
        <title>Voice Diagnostics - Gladia Debug</title>
      </Head>

      <main style={{
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1>🩺 Voice Recognition Diagnostics</h1>
        
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <button onClick={testMicrophone} style={buttonStyle}>
            🎤 Test Microphone
          </button>
          <button onClick={testGladiaAPI} style={buttonStyle}>
            🌐 Test Gladia API
          </button>
          <button onClick={testWebSocket} style={buttonStyle}>
            🔌 Test WebSocket
          </button>
          <button onClick={runAllTests} style={{...buttonStyle, background: '#10b981'}}>
            🚀 Run All Tests
          </button>
        </div>

        <div style={{
          background: '#f3f4f6',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>Status:</strong> {status}
        </div>

        <div style={{
          background: '#1f2937',
          color: '#f9fafb',
          padding: '20px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '14px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            Console Logs:
          </div>
          {logs.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Click a test button to see logs...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}

const buttonStyle = {
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  padding: '10px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500'
};
