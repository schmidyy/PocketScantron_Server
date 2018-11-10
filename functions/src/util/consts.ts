import * as functions from 'firebase-functions';

export const NUM_COLUMNS = 7;
export const NUM_ROWS = 15;

export const MAX_NUM = 100;

export const TOP_PADDING = 30;
export const CLUSTER_WIDTH = 30;

export const letters = ['A', 'B', 'C', 'D', 'E']

export const {
    computer_vision: subscriptionKey,
    endpoint: AZURE_CV_ENDPOINT,
} = functions.config().azure

export function getX (bb): number {
  const [ x, _, __, ___ ] = bb.split(',')
  return Number(x)
}

export function getY (bb): number {
  const [ _, y, __, ___ ] = bb.split(',')
  return Number(y)
}

export function toHex(d) {
  return  ("0"+(Number(d).toString(16))).slice(-2).toUpperCase()
}

export const topGroup = Array(NUM_COLUMNS).fill(null)
  .map((_, i) => (15 * i) + 1)

export const leftGroup = Array(NUM_ROWS).fill(null)
  .map((_, i) => i + 1)

export const gridSystem = leftGroup.map(
  i => Array(NUM_COLUMNS).fill(null)
  .map((_, j) => (15 * j) + i)
  ).reduce((acc, curr) => [...acc, ...curr], [])
