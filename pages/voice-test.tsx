import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import VoiceStreamer from '@/components/VoiceStreamer';

export default function VoiceTest() {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<Array<{transcript: string, isFinal: boolean, timestamp: Date}>>([]);
  const [status, setStatus] = useState('Ready');

  const handleTranscriptReceived = useCallback((transcript: string, isFinal: boolean) => {
    const newTranscript = {
      transcript,
      isFinal,
      timestamp: new Date()
    };
    
    setTranscripts(prev => [...prev.slice(-20), newTranscript]); // Keep last 20 transcripts
  }, []);

  const handleStatusChange = useCallback((newStatus: string) => {
    setStatus(newStatus);
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Voice error:', error);
    setStatus(`Error: ${error}`);
  }, []);

  const toggleListening = useCallback(() => {
    setIsListening(!isListening);
  }, [isListening]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  return (
    <>
      <Head>
        <title>Voice Recognition Test - Enhanced Gladia</title>
        <meta name="description" content="Test the enhanced Gladia voice recognition" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={{
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1 style={{ marginBottom: '20px', color: '#1f2937' }}>
          🎤 Enhanced Voice Recognition Test
        </h1>

        <div style={{
          background: '#f9fafb',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ marginTop: 0, color: '#374151' }}>Test Words</h2>
          <p style={{ margin: '10px 0', color: '#6b7280' }}>
            Try saying these words that commonly get misheard:
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
            marginTop: '10px'
          }}>
            {[
              'books', 'look', 'looks', 'hello', 'avatar', 'voice', 'chat',
              'talk', 'speak', 'say', 'tell', 'ask', 'kora', 'AI', 'help',
              'can', 'could', 'should', 'would', 'please', 'thank', 'thanks'
            ].map(word => (
              <span key={word} style={{
                background: '#ddd6fe',
                color: '#5b21b6',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                textAlign: 'center'
              }}>
                {word}
              </span>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          alignItems: 'center'
        }}>
          <button
            onClick={toggleListening}
            style={{
              background: isListening ? '#ef4444' : '#10b981',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isListening ? '🔴 Stop Listening' : '🎤 Start Listening'}
          </button>
          
          <button
            onClick={clearTranscripts}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>

          <div style={{
            background: isListening ? '#dcfce7' : '#f3f4f6',
            color: isListening ? '#166534' : '#374151',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Status: {status}
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          minHeight: '400px',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          <h3 style={{ marginTop: 0, color: '#374151' }}>
            Live Transcripts ({transcripts.length})
          </h3>
          
          {transcripts.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              Click "Start Listening" and begin speaking to see transcripts appear here...
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transcripts.map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: item.isFinal ? '#f0f9ff' : '#fef3c7',
                    border: `1px solid ${item.isFinal ? '#bae6fd' : '#fde68a'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <div style={{
                      color: item.isFinal ? '#0c4a6e' : '#92400e',
                      fontSize: '16px',
                      lineHeight: '1.4',
                      flex: 1
                    }}>
                      "{item.transcript}"
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{
                        background: item.isFinal ? '#10b981' : '#f59e0b', 
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        {item.isFinal ? 'FINAL' : 'PARTIAL'}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        color: '#6b7280'
                      }}>
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1e40af' }}>
            🔧 What's Enhanced:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e40af' }}>
            <li>Audio enhancer enabled for noise reduction</li>
            <li>Custom vocabulary for common misheard words</li>
            <li>Lower speech threshold (catches quieter speech)</li>
            <li>Improved endpointing (300ms vs default)</li>
            <li>Advanced audio processing with compression</li>
            <li>High-pass filter to reduce background noise</li>
            <li>Confidence filtering (only shows &gt;50% confidence)</li>
          </ul>
        </div>

        <VoiceStreamer
          isEnabled={isListening}
          apiKey={process.env.NEXT_PUBLIC_GLADIA_API_KEY || '42f4192e-55d4-4a27-830a-d62c2cb32c03'}
          onTranscriptReceived={handleTranscriptReceived}
          onStatusChange={handleStatusChange}
          onError={handleError}
        />
      </main>
    </>
  );
}
