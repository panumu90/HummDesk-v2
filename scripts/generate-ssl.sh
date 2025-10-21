#!/bin/bash

###############################################################################
# SSL Certificate Generation Script for HummDesk v2
#
# This script generates self-signed SSL certificates for development/testing.
# For production, use Let's Encrypt or a commercial CA.
#
# Usage:
#   ./scripts/generate-ssl.sh [domain]
#
# Example:
#   ./scripts/generate-ssl.sh localhost
#   ./scripts/generate-ssl.sh your-domain.com
###############################################################################

set -euo pipefail

# Configuration
DOMAIN="${1:-localhost}"
SSL_DIR="./nginx/ssl"
DAYS_VALID=365

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Generating SSL certificates for: ${DOMAIN}${NC}"

# Create SSL directory
mkdir -p ${SSL_DIR}

# Generate private key
openssl genrsa -out ${SSL_DIR}/key.pem 2048

# Generate certificate signing request
openssl req -new -key ${SSL_DIR}/key.pem -out ${SSL_DIR}/csr.pem \
    -subj "/C=FI/ST=Uusimaa/L=Helsinki/O=HummDesk/OU=IT/CN=${DOMAIN}"

# Generate self-signed certificate
openssl x509 -req -days ${DAYS_VALID} \
    -in ${SSL_DIR}/csr.pem \
    -signkey ${SSL_DIR}/key.pem \
    -out ${SSL_DIR}/cert.pem

# Clean up CSR
rm ${SSL_DIR}/csr.pem

# Set permissions
chmod 600 ${SSL_DIR}/key.pem
chmod 644 ${SSL_DIR}/cert.pem

echo -e "${GREEN}SSL certificates generated successfully!${NC}"
echo ""
echo "Certificate: ${SSL_DIR}/cert.pem"
echo "Private Key: ${SSL_DIR}/key.pem"
echo "Valid for: ${DAYS_VALID} days"
echo ""
echo -e "${BLUE}NOTE: These are self-signed certificates for development only.${NC}"
echo -e "${BLUE}For production, use Let's Encrypt or a commercial CA.${NC}"
