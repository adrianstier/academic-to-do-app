#!/bin/bash
# Deploy Supabase Edge Function for Push Notifications
# Run this script from the project root: ./scripts/deploy-edge-function.sh

set -e

PROJECT_REF="bzjssogezdnybbenqygq"
FUNCTION_NAME="send-push-notification"

echo "==================================="
echo "Deploying Push Notification Edge Function"
echo "==================================="

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    brew install supabase/tap/supabase
fi

# Check if logged in
if ! supabase projects list &> /dev/null 2>&1; then
    echo ""
    echo "Please login to Supabase CLI:"
    supabase login
fi

# Link to project
echo ""
echo "Linking to project: $PROJECT_REF"
supabase link --project-ref $PROJECT_REF

# Deploy the function
echo ""
echo "Deploying Edge Function: $FUNCTION_NAME"
supabase functions deploy $FUNCTION_NAME

echo ""
echo "==================================="
echo "Edge Function deployed successfully!"
echo "==================================="
echo ""
echo "IMPORTANT: You still need to add APNs secrets in Supabase Dashboard:"
echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
echo "2. Add these secrets:"
echo "   - APNS_KEY_ID: Your Apple Key ID (10 characters)"
echo "   - APNS_TEAM_ID: Your Apple Team ID (10 characters)"
echo "   - APNS_PRIVATE_KEY: Contents of your .p8 file"
echo "   - BUNDLE_ID: com.yourcompany.sharedtodolist"
echo "   - APNS_ENVIRONMENT: development (or production for App Store)"
echo ""
