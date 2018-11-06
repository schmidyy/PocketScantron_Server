import * as functions from 'firebase-functions';

import fetch from 'node-fetch'

import jimp = require('jimp')
import tinycolor = require("tinycolor2");


const NUM_COLUMNS = 7;
const NUM_ROWS = 15;

const MAX_NUM = 100;

const TOP_PADDING = 30;
const CLUSTER_WIDTH = 30;

const letters = ['A', 'B', 'C', 'D', 'E']

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

export function toHex(d) {
  return  ("0"+(Number(d).toString(16))).slice(-2).toUpperCase()
}

const topGroup = Array(NUM_COLUMNS).fill(null)
  .map((_, i) => (15 * i) + 1)

const leftGroup = Array(NUM_ROWS).fill(null)
  .map((_, i) => i + 1)

const gridSystem = leftGroup.map(
  i => Array(NUM_COLUMNS).fill(null)
    .map((_, j) => (15 * j) + i)
).reduce((acc, curr) => [...acc, ...curr], [])

// console.log(gridSystem)

export const documentScore = functions.https.onRequest(
  async ({ body }, response) => {
    const { url } = JSON.parse(body);
    // console.log(url)

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

    const clusteredRowY = gridSystem.reduce(
      (acc, c) => {
        const bb = numberTermsMap[c]

        if (!bb) {
          return acc
        }

        const _y = y(bb)

        const clusterKey = Object.keys(acc).find(
          cluster => Math.abs(Number(_y) - Number(cluster)) <= CLUSTER_WIDTH
        );

        if (clusterKey) {
          acc[clusterKey].push(bb)
        } else {
          acc[_y] = [ bb ]
        }
        return acc
      }
    , {})

    const clusteredColX = gridSystem.reduce(
      (acc, c) => {
        const bb = numberTermsMap[c]

        if (!bb) {
          return acc
        }

        const _x = x(bb)

        const clusterKey = Object.keys(acc).find(
          cluster => Math.abs(Number(_x) - Number(cluster)) <= CLUSTER_WIDTH
        );

        if (clusterKey) {
          acc[clusterKey].push(bb)
        } else {
          acc[_x] = [ bb ]
        }
        return acc
      }
    , {})

    const averageRowY = Object.keys(clusteredRowY)
      .map(k => clusteredRowY[k])
      .map(
        cluster => Number(cluster.reduce((a, c) => a + y(c), 0) / cluster.length)
      ).sort((a, b) => a - b)

    const averageColX = Object.keys(clusteredColX)
      .map(k => clusteredColX[k])
      .map(
        cluster => Number(cluster.reduce((a, c) => a + x(c), 0) / cluster.length)
      ).sort((a, b) => a - b)

    const image = await jimp.read(url)
    // console.log(url)
    let averageWidth = 0
    let averageHeight = 0

    for (let i = 0; i < averageColX.length - 1; i++) {
      averageWidth += Math.abs(averageColX[i + 1] - averageColX[i])
    }

    averageWidth /= averageColX.length

    for (let i = 0; i < averageRowY.length - 1; i++) {
      averageHeight += Math.abs(averageRowY[i + 1] - averageRowY[i])
    }

    averageHeight /= averageRowY.length

    image.blur(15)
    console.log('blurred')
    const chosenAnswers = []

    console.log('avg-width', averageWidth)
    console.log('avg-height', averageHeight)

    averageRowY.forEach(y => {
      averageColX.forEach(x => {
        // image.pixelate(averageHeight / 2, x, y, averageWidth, averageHeight)
        
        let darkest = {
          index: -1,
          luminance: Infinity,
        };

        for (let i = 5; i > 0; i--) {
          const pixelColor = image.getPixelColor(
            x + (averageWidth / i) - 30,
            y + (averageHeight / 2)
          )
          // console.log(pixelColor)

          const { r, g, b, a } = jimp.intToRGBA(pixelColor)

          const pixelLuminance = tinycolor(`rgba(${r}, ${g}, ${b}, ${a})`).getLuminance()
          console.log(pixelLuminance)
          if (darkest.luminance > pixelLuminance) {
            darkest = {
              index: 5 - i,
              luminance: pixelLuminance
            }
          }
        }
        console.log(darkest)
        chosenAnswers.push(letters[darkest.index])
      })
    })

    response.send(chosenAnswers)

    // const bestTop = {}

    // const bestNull = {}
  }
);
