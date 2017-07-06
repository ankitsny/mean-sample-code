// SAMPLE CODE

var router = require('express').Router();

var customerStoryApi = require('./apis/story.api');

// TODO: add middleware for auth, and access permissions

router.get('/', customerStoryApi.getCustomerStories);
router.get('/:id', customerStoryApi.getCustomerStory);
router.post('/', customerStoryApi.postCustomerStory);
router.put('/:id', customerStoryApi.putCustomerStory);
router.patch('/:id', customerStoryApi.patchCustomerStory);


router.get('/:id/imagesCL/:imageId?', customerStoryApi.getImagesCL);
router.post('/:id/imagesCL', customerStoryApi.postImagesCL);
router.delete('/:id/imagesCL/:imageId', customerStoryApi.deleteImagesCL);


module.exports = router;