# Chatbot Implementation Plan

## Overview
- Public-facing chatbot for visitors to ask questions about Good With Data CIC
- Uses Mistral AI (EU-based) for LLM responses
- Serverless deployment using GitHub (only US tech exception)
- All other services must be EU/UK-based

## Core Requirements
- Answer questions about company services, team, and approach
- Offer to send email for callback requests
- Log all conversations for reference
- Budget-controlled with hard cutoff limits

## Technical Implementation

### API & Services
- **LLM Provider**: Mistral AI (EU data centres)
- **Email Service**: Mailgun (EU data centres) or AWS SES (London region)
- **Hosting**: GitHub Pages (static) + GitHub Actions (backend)
- **Secrets Management**: GitHub Secrets for API keys

### Data & Knowledge
- Use `what_we_do.md` and `chatbot_script.md` as context
- Files small enough to pass directly in API context (no DB needed initially)
- Content sanitized before being passed to LLM

### Security & Safeguards
- Input sanitization to prevent prompt injection
- Content filtering for inappropriate requests
- Rate limiting via GitHub Actions built-in limits
- Hard cutoff for API usage (e.g., 100 requests/day or £10 spend)
- CAPTCHA to prevent bot abuse and control costs
- Conversations logged to secure storage (encrypted)

### Privacy & Compliance
- GDPR compliant data handling
- Clear user consent for data collection
- Option for users to request data deletion
- No storage of sensitive personal data beyond what's necessary

### Monitoring & Cost Control
- Monitor Mistral API usage via their dashboard
- Alerts for unusual activity or spending spikes
- Regular review of conversation logs
- Budget alerts at 50%, 75%, and 90% of monthly limit

### Deployment
- Static site remains on current hosting
- Chatbot API as separate GitHub repository
- GitHub Actions workflows for backend functions
- Environment variables for different deployment stages

### Fallback Mechanisms
- When API fails, show mailto link (hello@goodwithdata.org.uk)
- Graceful degradation for JavaScript-disabled users
- Clear error messages for users when limits are reached

## Next Steps
1. Set up Mistral API account and obtain key
2. Configure GitHub Secrets for API keys
3. Create separate repository for chatbot API
4. Implement basic chat endpoint with Mistral integration
5. Add context from knowledge files
6. Implement email callback functionality
7. Add logging system
8. Implement rate limiting and budget controls
9. Add CAPTCHA protection
10. Test and deploy
