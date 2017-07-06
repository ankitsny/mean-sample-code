// SAMPLE CODE

var router = require('express').Router();

var serviceApi = require('./routes/service.api');

// TODO: add middleware for auth, and access permissions

router.get('/', serviceApi.getServices);
router.post('/', serviceApi.postService);

router.get('/:id', serviceApi.getService);

router.put('/:id', serviceApi.putService);
router.patch('/:id', serviceApi.patchService);


router.get('/:id/showcases/:showcaseId?', serviceApi.getShowcases);
router.post('/:id/showcases/', serviceApi.postShowcases);
router.put('/:id/showcases/:showcaseId', serviceApi.putShowcases);
router.patch('/:id/showcases/:showcaseId', serviceApi.patchShowcases);
router.delete('/:id/showcases/:showcaseId', serviceApi.deleteShowcase);


router.post('/:id/imagesCL', serviceApi.postImagesCL);
router.delete('/:id/imagesCL/:imageId', serviceApi.deleteImagesCL);

router.post('/:id/showcases/imagesCL', serviceApi.postShowcasesImagesCL);
router.delete('/:id/showcases/imagesCL/:imageId', serviceApi.deleteShowcasesImagesCL);


module.exports = router;