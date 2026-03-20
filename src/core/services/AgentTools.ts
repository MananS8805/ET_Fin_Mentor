/**
 * Definitions for tools that the Financial Agent can call via Gemini's 
 * native function calling capability.
 */

export const AgentTools = [
  {
    name: "calculate_joint_optimization",
    description: "Analyze combined financial data for a couple and provide tax-saving HRA, NPS, and SIP strategies.",
    parameters: {
      type: "object",
      properties: {
        userName: { type: "string" },
        partnerName: { type: "string" },
        userIncome: { type: "number", description: "Annual gross income of the primary user" },
        partnerIncome: { type: "number", description: "Annual gross income of the partner" },
        totalJointHra: { type: "number", description: "Total annual HRA allowance available to the couple" },
      },
      required: ["userName", "partnerName", "userIncome", "partnerIncome"],
    },
  },
  {
    name: "get_tax_regime_comparison",
    description: "Compare Old vs New tax regime liability based on income and deductions.",
    parameters: {
      type: "object",
      properties: {
        annualIncome: { type: "number" },
        totalDeductions: { type: "number", description: "Sum of 80C, 80D, HRA, etc. for Old regime" },
      },
      required: ["annualIncome", "totalDeductions"],
    },
  },
];
