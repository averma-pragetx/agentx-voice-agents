// value must stay byte-identical to the slugs AgentX/app/api/agent.py (WEB_VOICE_CATEGORIES) validates.
export const VOICE_AGENT_CATEGORIES = [
    { label: 'Customer Support', value: 'customer_support' },
    { label: 'Lead Qualification', value: 'lead_qualification' },
    { label: 'Appointment Scheduling', value: 'appointment_scheduling' },
    { label: 'Call Routing', value: 'call_routing' },
]

export const INDUSTRY_OPTIONS = [
    { value: 'financial_services', title: 'Financial Services' },
    { value: 'insurance', title: 'Insurance' },
    { value: 'bpo', title: 'BPO' },
    { value: 'education', title: 'Education' },
    { value: 'healthcare', title: 'Healthcare' },
    { value: 'telecom', title: 'Telecom' },
    { value: 'general', title: 'General' },
]
