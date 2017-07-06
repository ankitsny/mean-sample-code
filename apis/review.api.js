// SAMPLE CODE

// INFO: Schema is not attached with this repo
var Review = require('./dbSchema/Review');


// TODO: Use Logger


/**
 * 2 params
 * @typedef {Object} Pagination
 * @property {number} page_size                 - Number of results to show in a page, optional?
 * @property {number} page_number               - Page number, optional?
 */
/**
 * @typedef {Object} FindReviewsOptions
 * @property {string} select                    - comma or sapce separated properties
 * @property {Pagination} pagination            - pagination object, contains page_size and page_number
 */
/**
 * @callback GetReviewsCallback
 * @param {Object} err                          - db error
 * @param {Object} reviews                      - Array of reviews
 */
/**
 * @description                                   findReviews function can be used to fetch reviews
 * @param {Object} q                            - Provide mogoDB match query, eg. {stars: count, serviceId: 'XXXXXXX', ..., propN: 'valueN'}
 * @param {FindReviewsOptions} [options]        - optional, contains pagination and select
 * @param {GetReviewsCallback} callback         - Callback function
 */
function findReviews(q, options, callback) {
    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : {};

    q = q || {};

    var pagination = options['pagination'] || {};
    var select = options['select'] || "";

    var defaultPageSize = 15;
    var defaultPageNumber = 1;

    pagination['page_size'] = parseInt(pagination['page_size'] || defaultPageSize);
    pagination['page_number'] = parseInt(pagination['page_number'] || defaultPageNumber);

    var toSkip = (pagination['page_number'] - 1) * (pagination['page_size']);

    var selection = select || '';
    selection = selection.replace(/,/g, ' '); // input: "name,phone,abc"; output: "name phone abc";

    // TODO: return only approved reviews to the user

    Review
        .find(q)
        .select(selection.toString())
        .skip(toSkip)
        .limit(pagination.page_size)
        .lean()
        .exec(function (err, reviews) {
            if (err) {
                return callback(err);
            }
            Review.count(q, function (err, count) {
                var totalPage = Math.ceil(count / pagination['page_size']);
                var next = (pagination['page_number'] + 1 < totalPage) ? pagination['page_number'] + 1 : undefined;
                var previous = (pagination['page_number'] > 1) ? pagination['page_number'] - 1 : undefined;
                return callback(null, { reviews: reviews, pagination: { count: count, totalPage: totalPage, next: next, previous: previous } });
            });
        });
}

exports.getReviews = function (req, res) {
    var q = req.query.q || "{}";
    var pagination = req.query.pagination || "{}";
    var select = req.query.select || "";
    try {
        q = JSON.parse(q);
        pagination = JSON.parse(pagination);
    } catch (e) {
        console.log(e);
        return res.status(400).send({ message: "Bad Request", e: e });
    }
    findReviews(q, { select: select || undefined, pagination: pagination || undefined }, function (err, results) {
        if (err) {
            console.log("getReviews: " + JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send({ reviews: results.reviews, pagination: results.pagination, message: "done" });
    });
}


/**
 * @callback FindReviewCallback
 * @param {Object} err                                                                  - Db Error
 * @param {Object} review                                                               - review Object 
 */
/**
 * @typedef {Object} FindReviewOptions
 * @property {string} select                                                            - Space or comma separated properties
 */
/**
 * This function can be used to find Review using its Id   
 * @param {string} id                                                                   - Review _id 
 * @param {FindReviewOptions} [options]                                                 - Optional Param, e.g. {select: 'name key description'}
 * @param {FindReviewCallback} callback                                                 - callback function(err, review);
 */
function findReview(id, options, callback) {
    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : {};
    var select = options.select || '';
    select = select.replace(/,/g, ' ');
    Review
        .findById(id)
        .select(select.toString())
        .lean()
        .exec(function (err, review) {
            return callback(err, review);
        });
}

exports.getReview = function (req, res) {
    if (!req.params.id) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }

    var select = req.params.select || ' ';
    findReview(req.params.id, { select: select }, function (err, review) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(review);
    });
}


/**
 * @callback CreateReviewCallback
 * @param {Object} err                                                          - Db Error
 * @param {Object} review                                                       - new review document
 */
/**
 * @typedef {Object} ReviewObj                                                  - Review object,
 * @property {number?} stars                                                    - Number of stars
 * @property {string} userName                                                  - Reviewers name,
 * @property {string?} description                                              - Review Text
 * @property {boolean?} approved                                                - default false
 * @property {string?} userId                                                   - User Id of the reviewers
 * @property {string} serviceId                                                 - Service Id
 */
/**
 * To create a new Review
 * @param {ReviewObj} reviewData                                                - New Review Object, 
 * @param {CreateReviewCallback} callback                                       - callback function(err, review)
 */
function createReview(reviewData, callback) {
    var review = new Review(reviewData);
    review.save(function (err, _review) {
        return callback(err, review);
    });
}
exports.postReview = function (req, res) {
    if (!req.body.review) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    createReview(req.body.review, function (err, _review) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(_review);
    });
}


/**
 * @callback UpdateReviewCallback
 * @param {Object} err                                                              - Db Error  
 * @param {Object} review                                                           - review document after update
 */
/**
 * Update Review Document, similar as Put Request
 * @param {Object} review                                                           - review object with update
 * @param {UpdateReviewCallback} callback                                           - callback function(err, review)
 */
function updateReview(review, callback) {
    Review.findByIdAndUpdate(review._id, review, function (err, _review) {
        return callback(err, _review);
    });
}

exports.putReview = function (req, res) {
    if (!req.params.id || !req.body.review) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    updateReview(req.body.review, function (err, review) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(review);
    });
}


/**
 * @callback ModifyReviewCallback
 * @property {Object} err                                                   - Db Error
 * @property {Object} review                                                - review doc
 */
/**
 * there can be multiple path and multiple value
 * @typedef {Object} PROPS
 * @property {string} path1                                                 - path/property thats needs to be updated 
 * @property {string} value1                                                - New Value 
 */
/**
 * This function can be used to patch some properties of Review doc, Similar to patch request
 * @param {string} id 
 * @param {PROPS} props                                                     - an Object with patch values, eg. {name:'name', path: 'value' ... , pathN: 'valueN'}
 * @param {ModifyReviewCallback} callback                                   - callback function(err, review) 
 */
function modifyReview(id, props, callback) {
    Review
        .findByIdAndUpdate(id, props, { new: true })
        .exec(function (err, review) {
            return callback(err, review);
        });
}

exports.patchReview = function (req, res) {
    if (!req.params.id || !req.body.payload) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    modifyReview(req.params.id, req.body.payload, function (err, review) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'BDE' });
        }
        return res.status(200).send(review);
    });
}

/**
 * @callback RemoveReviewCallback
 * @param {Object} [err]                                                - Db Error 
 */
/**
 * function to delete a review
 * @param {string} id                                                   - review id
 * @param {RemoveReviewCallback} callback                               - callback function(err)
 */
function removeReview(id, callback) {
    Review.findByIdAndRemove(id, function (err) {
        return callback(err);
    });
}

exports.deleteReview = function (req, res) {
    if (!req.params.id) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    removeReview(req.params.id, function (err) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send({ message: 'Review Deleted' });
    });
}