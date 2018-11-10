import { scoreDocument } from './document-score'
import { subscriptionKey } from '../../util';

const body = {
    "url": "https://firebasestorage.googleapis.com/v0/b/pocketscantron.appspot.com/o/5F9F851B-D018-4E37-81FD-6363AD6A5939.jpg?alt=media&token=ae924527-680d-4ad4-a3d0-3b93e7d36bc3",
    "numQuestions": 20
}


console.log(subscriptionKey)

scoreDocument(body, {
    status () {
        return {
            send (...args) {
                console.log(...args)
            }
        }
    },
    send (...args) {
        console.log(...args)
    }
} as any)