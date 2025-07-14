import { UserInputSchema } from '../src/types';

describe('Simple System Test', () => {
  it('should validate user input schema', () => {
    const validInput = {
      mentalState: 'Feeling anxious',
      sleepPattern: 7,
      stressLevel: 6,
      supportSystem: ['family', 'friends'],
      recentChanges: 'Started new job',
      currentSymptoms: ['anxiety', 'insomnia']
    };

    const result = UserInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid user input', () => {
    const invalidInput = {
      mentalState: '', // Empty string
      sleepPattern: 15, // Too high
      stressLevel: 12, // Too high
      supportSystem: 'not-an-array', // Wrong type
      currentSymptoms: 'not-an-array' // Wrong type
    };

    const result = UserInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should have proper environment setup', () => {
    expect(process.env['NODE_ENV']).toBe('test');
    expect(process.env['OPENAI_API_KEY']).toBeDefined();
  });
}); 