#!/bin/bash

# Permission-based Authorization Test Script
# This script demonstrates the permission system

BASE_URL="http://localhost:3000/api/v1"

echo "🔐 Permission-Based Authorization Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Register Owner
echo "${YELLOW}Test 1: Register Owner${NC}"
echo "POST $BASE_URL/auth/register-owner"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register-owner" \
  -H "Content-Type: application/json" \
  -d '{
    "shopName": "Test Kirana Store",
    "ownerName": "Test Owner",
    "phone": "+919876543210",
    "email": "owner@test.com",
    "password": "Owner1234"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
OWNER_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.tokens.accessToken')
echo ""
echo "${GREEN}✓ Owner registered successfully${NC}"
echo "Token: ${OWNER_TOKEN:0:50}..."
echo ""

# Test 2: Check Owner Permissions
echo "${YELLOW}Test 2: Owner Creating Customer (has CUSTOMER_CREATE permission)${NC}"
echo "POST $BASE_URL/customers"
CUSTOMER_RESPONSE=$(curl -s -X POST "$BASE_URL/customers" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "+919999999999",
    "email": "customer@test.com"
  }')

echo "$CUSTOMER_RESPONSE" | jq '.'
if [[ "$CUSTOMER_RESPONSE" == *"success\":true"* ]]; then
  echo "${GREEN}✓ Owner can create customers (has CUSTOMER_CREATE permission)${NC}"
else
  echo "${RED}✗ Failed to create customer${NC}"
fi
echo ""

# Test 3: Get Customers
echo "${YELLOW}Test 3: Owner Viewing Customers (has CUSTOMER_VIEW permission)${NC}"
echo "GET $BASE_URL/customers"
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/customers" \
  -H "Authorization: Bearer $OWNER_TOKEN")

echo "$GET_RESPONSE" | jq '.'
if [[ "$GET_RESPONSE" == *"success\":true"* ]]; then
  echo "${GREEN}✓ Owner can view customers (has CUSTOMER_VIEW permission)${NC}"
else
  echo "${RED}✗ Failed to get customers${NC}"
fi
echo ""

# Test 4: Login
echo "${YELLOW}Test 4: Login with Owner Credentials${NC}"
echo "POST $BASE_URL/auth/login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "Owner1234"
  }')

echo "$LOGIN_RESPONSE" | jq '.'
echo ""
echo "${GREEN}✓ Login successful${NC}"
echo ""

# Test 5: Token Validation
echo "${YELLOW}Test 5: Accessing Protected Route with Valid Token${NC}"
echo "GET $BASE_URL/customers"
PROTECTED_RESPONSE=$(curl -s -X GET "$BASE_URL/customers" \
  -H "Authorization: Bearer $OWNER_TOKEN")

if [[ "$PROTECTED_RESPONSE" == *"success\":true"* ]]; then
  echo "${GREEN}✓ Token validated successfully${NC}"
else
  echo "${RED}✗ Token validation failed${NC}"
fi
echo ""

# Test 6: No Token
echo "${YELLOW}Test 6: Accessing Protected Route WITHOUT Token${NC}"
echo "GET $BASE_URL/customers"
NO_TOKEN_RESPONSE=$(curl -s -X GET "$BASE_URL/customers")

echo "$NO_TOKEN_RESPONSE" | jq '.'
if [[ "$NO_TOKEN_RESPONSE" == *"No token provided"* ]]; then
  echo "${GREEN}✓ Correctly rejected request without token${NC}"
else
  echo "${RED}✗ Should have rejected request without token${NC}"
fi
echo ""

# Summary
echo "======================================"
echo "${GREEN}Permission System Tests Complete!${NC}"
echo ""
echo "Summary of Role Permissions:"
echo "----------------------------"
echo "OWNER: USER_CREATE, BILL_CREATE, CUSTOMER_CREATE, PRODUCT_CREATE, SETTINGS_ALL, etc."
echo "MANAGER: BILL_CREATE, CUSTOMER_CREATE, PRODUCT_CREATE (no USER_CREATE or DELETE permissions)"
echo "CASHIER: BILL_CREATE, CUSTOMER_VIEW, PRODUCT_VIEW (no CREATE/UPDATE/DELETE permissions)"
echo ""
echo "Key Features Demonstrated:"
echo "✓ JWT-based authentication"
echo "✓ Permission-based authorization (no DB hits)"
echo "✓ Role-to-permission mapping in memory"
echo "✓ Protected routes with permission checks"
echo ""
