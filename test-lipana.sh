#!/bin/bash

# Lipana STK Push Diagnostic Script
# This script tests the Lipana integration without needing the mobile app

echo "=== Lipana STK Push Diagnostic ==="
echo ""

# Check environment variables
echo "1. Checking environment variables..."
if [ -f ".env" ]; then
    LIPANA_KEY=$(grep EXPO_PUBLIC_LIPANA_SECRET_KEY .env | cut -d= -f2)
    if [ -n "$LIPANA_KEY" ]; then
        echo "✓ LIPANA_SECRET_KEY found: ${LIPANA_KEY:0:20}..."
    else
        echo "✗ LIPANA_SECRET_KEY not found"
    fi
else
    echo "✗ .env file not found"
fi

echo ""
echo "2. Testing Lipana API directly..."
echo ""

# Test parameters
PHONE="+254708374149"
AMOUNT="100"
API_KEY="${LIPANA_KEY}"
API_URL="https://api.lipana.dev/v1/transactions/push-stk"

echo "Sending STK Push request..."
echo "Phone: $PHONE"
echo "Amount: KES $AMOUNT"
echo "URL: $API_URL"
echo ""

# Make the API call
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"phone\": \"$PHONE\",
    \"amount\": $AMOUNT,
    \"accountReference\": \"DIAG-TEST\",
    \"transactionDesc\": \"Diagnostic Test\"
  }")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

echo ""
echo "3. Response Analysis..."

# Extract transaction ID if present
TRANSACTION_ID=$(echo "$RESPONSE" | jq -r '.data.transactionId // .data.data.transactionId // .transactionId // empty' 2>/dev/null)

if [ -n "$TRANSACTION_ID" ]; then
    echo "✓ Transaction ID: $TRANSACTION_ID"
    echo ""
    echo "4. Testing webhook with this transaction..."
    
    WEBHOOK_URL="https://fzcdimeuloecsxoqcmyr.supabase.co/lipana-webhook"
    
    WEBHOOK_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"event\": \"payment.success\",
        \"data\": {
          \"transactionId\": \"$TRANSACTION_ID\",
          \"transaction_id\": \"$TRANSACTION_ID\",
          \"amount\": $AMOUNT,
          \"phone\": \"$PHONE\",
          \"phone_number\": \"$PHONE\",
          \"status\": \"success\",
          \"checkoutRequestID\": \"TEST123\"
        }
      }")
    
    echo "Webhook Response:"
    echo "$WEBHOOK_RESPONSE" | jq . 2>/dev/null || echo "$WEBHOOK_RESPONSE"
else
    echo "✗ No transaction ID in response"
    echo "Check your API key is correct"
fi

echo ""
echo "=== Diagnostic Complete ==="
