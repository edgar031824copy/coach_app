import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only cleans up by itself when Vitest globals are on; they are off here, so unmount after each test.
afterEach(cleanup);
