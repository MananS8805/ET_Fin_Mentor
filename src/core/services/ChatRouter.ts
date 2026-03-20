export const ChatRouter = {
  routeMessage(message: string): string | null {
    const text = message.toLowerCase();

    if (/(tax|regime|80c|deduction|hra|form 16)/.test(text)) {
      return "I can help you optimize your taxes! Please use our dedicated Tax Wizard and Form 16 scanner on your dashboard for the most accurate, personalized tax saving plan.";
    }

    if (/(portfolio|mutual fund|sip|overlap|xirr|cams|rebalance)/.test(text)) {
      return "To analyze your portfolio deeply, please upload your CAMS statement in the Portfolio section. FinMentor will automatically detect overlapping funds and calculate your XIRR.";
    }

    if (/(insurance|term cover|health cover|health insurance)/.test(text)) {
      return "For insurance gaps, I recommend checking your Health Score on the dashboard, which analyzes your term and health cover against your target requirements.";
    }
    
    // FAQ
    if (/(what is fire|how to fire|financial independence)/.test(text)) {
      return "FIRE (Financial Independence, Retire Early) is a milestone where your investments generate enough passive income to cover your living expenses. You can track your FIRE target in the 'Future You' section!";
    }

    return null; // Return null to proceed with Gemini call
  }
};
