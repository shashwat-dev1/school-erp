/**
 * HanuJai High School ERP — Data Layer Entry Point
 */

import { getDataMode } from '../config/firebase';
import type { DataProvider } from './provider';
import { demoRepository } from './demo/demoRepository';
import { firestoreRepository } from './firebase/firestoreRepository';

export function getDataProvider(): DataProvider {
  const mode = getDataMode();
  if (mode === 'firebase') {
    return firestoreRepository;
  }
  return demoRepository;
}

export { demoRepository, firestoreRepository };
export type { DataProvider } from './provider';
