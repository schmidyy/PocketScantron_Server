import * as functions from 'firebase-functions';

import fetch from 'node-fetch'

import jimp = require('jimp')
import tinycolor = require("tinycolor2");
import { subscriptionKey, NUM_COLUMNS, NUM_ROWS, AZURE_CV_ENDPOINT, MAX_NUM, CLUSTER_WIDTH, letters, gridSystem, x, y, TOP_PADDING } from '../../util';

export async function scoreDocument (body: string, response: functions.Response) {
    const { url, numQuestions } = JSON.parse(body);
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

    // image.blur(15)
    console.log('blurred')
    const chosenAnswers = []

    console.log('avg-width', averageWidth)
    console.log('avg-height', averageHeight)

    console.log('averageRowY', averageRowY.length)
    console.log('averageColX', averageColX.length)

    let currQuestion = 0

    averageColX.forEach(x => {
      averageRowY.forEach(y => {
         // image.clone().crop(x + 30, y - (averageHeight / 2), averageWidth - 30, averageHeight).write(`./${Math.floor(x)}-${Math.floor(y)}-${Math.floor(averageWidth)}-${Math.floor(averageHeight)}.jpg`)
        currQuestion += 1

        if (currQuestion <= numQuestions) {
          const estimatedLetterGuess = darkestArea(image, x + 30, y - (averageHeight / 2), averageWidth - 35, averageHeight)

          chosenAnswers.push({
            current_question: currQuestion,
            letter_guess: estimatedLetterGuess
          })
        }
      })
    })
    response.send(chosenAnswers)
}

function darkestArea(image: jimp, x: number, y: number, width: number, height: number): string {
  const segmentWidth = width / 5
  const segmentHeight = height / 20
  
  const buckets = {}
  
  for (let i = 0; i < 5; i++) {
    buckets[x + (segmentWidth * (i + 1))] = 0
  }

  const sortedBucketIndices = Object.keys(buckets).sort((a, b) => Number(a) - Number(b))
  
  // Scan across subsection
  for (let i = x; i < x + width; i++) {
    for (let j = 0; j < 20; j++) {
      const pixelColor = image.getPixelColor(i, y + (segmentHeight * (j + 1)))

      const { r, g, b, a } = jimp.intToRGBA(pixelColor)
      const pixelLuminance = tinycolor(`rgba(${r}, ${g}, ${b}, ${a})`).getLuminance()
      
      const bucketIndex = sortedBucketIndices.find(
        bucketValue => i < Number(bucketValue)
      )

      buckets[bucketIndex] += pixelLuminance
    }
  }

  console.log(buckets)


  // let bestIndex = 0

  // for (let i = 0; i < sortedBucketIndices.length; i++) {
  //   if (buckets[] 
  // }


  const discoveredIndex = sortedBucketIndices.reduce(
    (minBucketIndex, currentBucketValue, currentBucketIndex) => {
      if (minBucketIndex === null) {
        return currentBucketIndex
      }
      if (buckets[sortedBucketIndices[minBucketIndex]] > buckets[currentBucketValue]) {
        return currentBucketIndex
      }

      return minBucketIndex
    }
  , null)

  console.log(discoveredIndex)

  return letters[discoveredIndex]
}