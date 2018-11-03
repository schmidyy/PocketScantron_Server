import * as functions from 'firebase-functions';
import fetch from 'node-fetch'

const NUM_COLUMNS = 7;
const NUM_ROWS = 15;

const MAX_NUM = 100;

const TOP_PADDING = 30;

const {
  computer_vision: subscriptionKey,
  endpoint: AZURE_CV_ENDPOINT,
} = functions.config().azure

export function x (bb): number {
  const [ x, _, __, ___ ] = bb.split(',')
  return Number(x)
}

export function y (bb): number {
  const [ _, y, __, ___ ] = bb.split(',')
  return Number(y)
}

const topGroup = Array(NUM_COLUMNS).fill(null)
  .map((_, i) => (15 * i) + 1)

const leftGroup = Array(NUM_ROWS).fill(null)
  .map((_, i) => i + 1)

export const documentScore = functions.https.onRequest(
  async ({ body }, response) => {
    const { url } = JSON.parse(body);
    console.log(url)


    const cvResponse = await fetch(AZURE_CV_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key' : subscriptionKey,
      },
      body: JSON.stringify({ url }),
    });

    const cvResult = await cvResponse.json();

    if (!cvResult.regions) {
      response.status(405).send({ message: 'invalid response (custom error)'});
    }

    const terms = cvResult.regions.reduce((regionAcc, region) => [
      ...regionAcc,
      ...region.lines.reduce((acc, line) => [
        ...acc,
        ...line.words
      ], [])
    ], [])


    const numberTerms = terms.filter(
      ({ text }) => !Number.isNaN(Number(text))
    ).filter(
      ({ text }) => Number(text) <= MAX_NUM
    )

    const numberTermsMap = numberTerms.reduce(
      (acc, { text, boundingBox }) => ({
        ...acc,
        [text]: boundingBox
      })
    , {})

    console.log(numberTermsMap)

    const filteredTopGroup = topGroup.filter(g => Boolean(numberTermsMap[g]))
    const filteredLeftGroup = leftGroup.filter(g => Boolean(numberTermsMap[g]))

    const bestTop = filteredTopGroup.reduce(
      (acc, c) => {
        const curr = y(numberTermsMap[c])
        console.log('y', curr)
        return acc + curr
      }
    , 0) / filteredTopGroup.length

    const bestLeft = filteredLeftGroup.reduce(
      (acc, c) => {
        const curr = x(numberTermsMap[c])
        console.log('x', curr)
        return acc + curr
      }
    , 0) / filteredLeftGroup.length

    let columnWidth = 0

    for (let i = 0 ; i < filteredTopGroup.length - 1; i++) {
      const curr = filteredTopGroup[i]
      const next = filteredTopGroup[i + 1]

      const deltaX = x(numberTermsMap[next]) - x(numberTermsMap[curr])
      columnWidth += deltaX
    }

    columnWidth /= filteredTopGroup.length;

    response.send({
      bestTop,
      bestLeft,
      columnWidth
    })

    // const bestTop = {}

    // const bestNull = {}
  }
);
