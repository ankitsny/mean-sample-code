
// SAMPLE CODE

var router = require('express').Router();

var reviewApi = require('./routes/review.api');

// TODO: use middleware to check the access permission and auth.

router.get('/', reviewApi.getReviews);
router.get('/:id', reviewApi.getReview);

router.post('/', reviewApi.postReview);
router.put('/:id', reviewApi.putReview);
router.patch('/:id', reviewApi.patchReview);
router.delete('/:id', reviewApi.deleteReview);


module.exports = router;
