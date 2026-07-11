export interface DemoPersona {
  id: string;
  name: string;
  label: string;
  summary: string;
  prompt: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { id: "demo-new-student", name: "Maria", label: "Brand new", summary: "Starts with simple English and no learning history.", prompt: "Explain photosynthesis" },
  { id: "demo-bisaya-learner", name: "Juan", label: "Cebuano-first", summary: "Learns in Cebuano first, then bridges to academic English.", prompt: "Explain photosynthesis like I'm 10" },
  { id: "demo-english-advanced", name: "Alex", label: "Advanced", summary: "Receives deeper analysis and harder examples.", prompt: "Explain situational irony with a harder example" },
  { id: "demo-struggling-student", name: "Bea", label: "Needs support", summary: "Receives encouragement and smaller steps.", prompt: "I don't get quadratic equations. It looks hard." },
];
