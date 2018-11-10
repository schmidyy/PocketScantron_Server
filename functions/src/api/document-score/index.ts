import * as functions from 'firebase-functions';
import { scoreDocument } from './document-score';

export const documentScore = functions.https.onRequest(
    async ({ body }, response) => {
        await scoreDocument(body, response)
    }
);