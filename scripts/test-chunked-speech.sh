#!/bin/bash

# Test script for chunked speech functionality
echo "Testing Chunked Speech Implementation"
echo "===================================="

# Test 1: Basic chunked speech with short text
echo "Test 1: Short text chunking"
curl -X POST http://localhost:3000/api/speech-chunked \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello there! How are you doing today? I hope you are having a wonderful day.",
    "maxSentencesPerChunk": 2,
    "streaming": false
  }' | jq '.totalChunks'

echo ""

# Test 2: Long text chunking  
echo "Test 2: Long text chunking"
curl -X POST http://localhost:3000/api/speech-chunked \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a much longer piece of text that should be split into multiple chunks. Each chunk should contain approximately two sentences for optimal speech generation. The system should handle this gracefully and provide smooth playback. We want to test how well the chunking algorithm works with various sentence structures. Some sentences are short. Others are much longer and contain multiple clauses that could potentially cause issues with the chunking algorithm, but we expect it to handle them properly.",
    "maxSentencesPerChunk": 2,
    "streaming": false
  }' | jq '.totalChunks, .chunks[].text'

echo ""
echo "Tests completed. Check the JSON output above for chunking results."
