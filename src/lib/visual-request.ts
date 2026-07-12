// Detects when a student asks to learn through an on-screen visual instead of text.
export function isVisualLearningRequest(message: string) {
  return /visual|diagram|infographic|chart|picture|illustration|drawing|graph|image(?:\s+of)?|show me|illustrate|need to see|want to see|see something|can'?t learn (?:with|using) text|cannot learn (?:with|using) text/i.test(message);
}
