// SAMPLE CODE


// INFO: Schema is not attached with this repo
var CustomerStory = require('./dbSchema/CustomerStory');
var FileMap = require('./dbSchema/FileMap');


// TODO: Use Logger


// TODO: Make a common module for this function
/**
 * Update File map      
 * @param {Array} files                             - Array of fileMap Ids
 * @param {Object} toUpdate                         - Patch Object, eg. {mappedStatus: true};
 * @param {UpdateFileMapCallback} [callback]        - Optional?, Callback function (err, doc) 
 */
function updateFileMap(files, toUpdate, callback) {
    if ((!files || !Array.isArray(files) || !!files.length) && callback) {
        return callback(new Error("FileMap ids missing"));
    }
    if ((!files || !Array.isArray(files) || !!files.length) && !callback) {
        return false;
    }

    FileMap.update(
        { _id: { $in: files } },
        toUpdate,
        { multi: true }
    ).exec(function (err, docs) {
        if (callback) {
            return callback(err, docs);
        }
    });
}




/**
 * 2 params
 * @typedef {Object} Pagination
 * @property {number} page_size                                     - Number of results to show in a page, optional?
 * @property {number} page_number                                   - Page number, optional?
 */
/**
 * @typedef {Object} FindCustomerStoriesOptions
 * @property {string} select                                        - comma or sapce separated properties
 * @property {Pagination} pagination                                - pagination object, contains page_size and page_number
 */
/**
 * @callback GetCustomerStorriesCallback
 * @param {Object} err                                              - db error
 * @param {Object} customerStories                                  - Array of CustomerStory
 */
/**
 * @description                                                       findCustomerStories function can be used to fetch CustomerStory
 * @param {Object} q                                                - Provide mogoDB match query, eg. {url: 'some url', type: 'catering-', ..., propN: 'valueN'}
 * @param {FindCustomerStoriesOptions} [options]                      - optional, contains pagination and select
 * @param {GetCustomerStoriesCallback} callback                       - Callback function
 */
function findCustomerStories(q, options, callback) {
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
    selection = selection.replace(/,/g, ' '); // input: "url,title,description"; output: "name phone abc";

    CustomerStory
        .find(q)
        .select(selection.toString())
        .skip(toSkip)
        .limit(pagination.page_size)
        .lean()
        .exec(function (err, customerStories) {
            if (err) {
                return callback(err);
            }
            CustomerStory.count(q, function (err, count) {
                var totalPage = Math.ceil(count / pagination['page_size']);
                var next = (pagination['page_number'] + 1 < totalPage) ? pagination['page_number'] + 1 : undefined;
                var previous = (pagination['page_number'] > 1) ? pagination['page_number'] - 1 : undefined;
                return callback(null, { customerStories: customerStories, pagination: { count: count, totalPage: totalPage, next: next, previous: previous } });
            });
        });
}

exports.getCustomerStories = function (req, res) {
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
    findCustomerStories(q, { select: select || undefined, pagination: pagination || undefined }, function (err, results) {
        if (err) {
            console.log("getCustomerStories: " + JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send({ customerStories: results.customerStories, pagination: results.pagination, message: "done" });
    });
}




/**
 * @callback FindCustomerStoryCallback
 * @param {Object} err                                                                  - Db Error
 * @param {Object} customerStory                                                        - customerStory Object 
 */
/**
 * @typedef {Object} FindCustomerStoryOptions
 * @property {string} select                                                            - Space or comma separated properties
 */
/**
 * This function can be used to find CustomerStory using its Id   
 * @param {string} id                                                                   - CustmerStory _id 
 * @param {FindCustomerStoryOptions} [options]                                          - Optional Param, e.g. {select: 'name key description'}
 * @param {FindCustomerStoryCallback} callback                                          - callback function(err, customerStory);
 */
function findCustomerStory(id, options, callback) {
    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : {};
    var select = options.select || '';
    select = select.replace(/,/g, ' ');
    CustomerStory
        .findById(id)
        .select(select.toString())
        .lean()
        .exec(function (err, customerStory) {
            return callback(err, customerStory);
        });
}

exports.getCustomerStory = function (req, res) {
    if (!req.params.id) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }

    var select = req.params.select || ' ';
    findCustomerStory(req.params.id, { select: select }, function (err, customerStory) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(customerStory);
    });
}




/**
 * @callback CreateCustomerStoryCallback
 * @param {Object} err                                                          - Db Error
 * @param {Object} customerStory                                                - new CustomerStory document
 */
/**
 * To create a new CustomerStory
 * @param {CustomerStory} customerStoryData                                     - New CustomerStory Object, 
 * @param {CreateCustomerStoryCallback} callback                                - callback function(err, customerStory)
 */
function createCustomerStory(customerStoryData, callback) {
    var customerStory = new CustomerStory(customerStoryData);

    var imageIds = [];

    customerStory.save(function (err, _customerStory) {
        imageIds = _customerStory['imagesCL'];
        if (!err) {
            updateFileMap(imageIds, { mappedStatus: true });
        }
        return callback(err, _customerStory);
    });
}
exports.postCustomerStory = function (req, res) {
    if (!req.body.customerStory) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    createCustomerStory(req.body.customerStory, function (err, customerStory) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(customerStory);
    });
}




/**
 * @callback UpdateCustomerStoryCallback
 * @param {Object} err                                                                          - Db Error
 * @param {Object} customerStory                                                                - customerStory after update
 */
/**
 * updateCustomerStory function can be used to update the entire doc, similar to Put request
 * @param {Object} CustomerStory                                                                - entire customerStory doucument with updated values
 * @param {UpdateCustomerStoryCallback} callback                                                - callback function(err, customerStory)
 */
function updateCustomerStory(customerStory, callback) {
    // imagesCL can't be patched here;
    delete customerStory['imagesCL'];

    CustomerStory
        .findByIdAndUpdate(customerStory._id, customerStory, { new: true })
        .populate('imagesCL', 'urls')
        .exec(function (err, _customerStory) {
            return callback(err, _customerStory);
        });
}

exports.putCustomerStory = function (req, res) {
    if (!req.params.id || !req.body.customerStory) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    updateCustomerStory(req.body.customerStory, function (err, customerStory) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(customerStory);
    });
}



/**
 * @callback ModifyCustomerStoryCallback
 * @property {Object} err                                                           - Db Error
 * @property {Object} customerStory                                                 - customerStory doc
 */
/**
 * there can be multiple path and multiple value
 * @typedef {Object} PROPS
 * @property {string} path1                                                         - path/property thats needs to be updated 
 * @property {string} value1                                                        - New Value 
 */
/**
 * This function can be used to patch some properties of CustomerStory doc, Similar to Patch request
 * @param {string} id                                                               - CustomerStory _id
 * @param {PROPS} props                                                             - an Object with patch values, eg. {name:'name', path: 'value' ... , pathN: 'valueN'}
 * @param {ModifyCustomerStoryCallback} callback                                    - callback function(err, customerStory) 
 */
function modifyCustomerStory(id, props, callback) {
    // images can't be patched here
    delete props['imagesCL']
    CustomerStory
        .findByIdAndUpdate(id, props, { new: true })
        .populate('imagesCL', 'urls')
        .exec(function (err, customerStory) {
            return callback(err, customerStory);
        });
}

exports.patchCustomerStory = function (req, res) {
    if (!req.params.id || !req.body.payload) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    modifyCustomerStory(req.params.id, req.body.payload, function (err, customerStory) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'BDE' });
        }
        return res.status(200).send(customerStory);
    });
}





/**
 * @callback CreateImagesCLCallback
 * @property {Object} err                                           - Db Error
 * @property {Object} CustomerStory                                 - CustomerStory Document after update
 */
/**
 * to push new customerStory Image
 * @param {string} id                                               - CustomerStory id(_id)
 * @param {string|Array.string} imageIds                            - fileMap id or array of ids
 * @param {CreateImagesCLCallback} callback                         - callback function(err, customerStory);
 */
function createImagesCL(id, imageIds, callback) {
    // Check if its an array
    if (imageIds && !Array.isArray(imageIds)) {
        imageIds = [imageIds];
    }
    CustomerStory
        .findByIdAndUpdate(id, { $push: { imagesCL: { $each: imageIds } } }, { new: true })
        .populate('imagesCL', 'urls')
        .exec(function (err, customerStory) {
            if (!err) {
                updateFileMap(imageIds, { mappedStatus: true });
            }
            return callback(err, customerStory);
        });
}

exports.postImagesCL = function (req, res) {
    if (!req.params.id || !req.body.imagesCL) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }
    createImagesCL(req.params.id, req.body.imagesCL, function (err, customerStory) {
        if (err) {
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send(customerStory);
    });
}



/**
 * @callback RemoveImagesCLCallback
 * @property {Object} err                                               - Db Error
 * @property {Object} customerStory                                     - customerStory Doucument after update
 */
/**
 * Delete images from customerStory
 * @param {string} id                                                   - customerStory id
 * @param {string|Array.string} imageIds                                - imageId or array of imageIds
 * @param {RemoveImagesCLCallback} callback                             - callback function(err, customerStory)
 */
function removeImagesCl(id, imageIds, callback) {
    if (imageIds && !Array.isArray(imageIds)) {
        imageIds = [imageIds];
    }
    CustomerStory
        .findByIdAndUpdate(id, { $pull: { imagesCL: { $in: imageIds } } }, { new: true })
        .populate('imagesCL', 'urls')
        .exec(function (err, customerStory) {
            if (!err) {
                updateFileMap(imageIds, { markedAsDelete: true });
            }
            return callback(err, customerStory);
        });
}

exports.deleteImagesCL = function (req, res) {
    if (!req.params.id || !req.params.imageId) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }
    removeImagesCL(req.params.id, req.params.imageId, function (err, customerStory) {
        if (err) {
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send(customerStory);
    });
}

/**
 * @callback FindImagesCLCallback
 * @param {object} err                                                  - Db Error                                                               
 * @param {Object|Array.Object} images                                  - image object or array of image object    
 */
/**
 * to get customerStory image/images
 * @param {string} id                                                   - CustomerStory id
 * @param {string} [imageId]                                            - Image Id, optional
 * @param {FindImagesCLCallback} callback                               - callback function(err, image|images)
 */
function findImagesCL(id, imageId, callback) {
    CustomerStory
        .findById(id)
        .select('imagesCL')
        .populate('imagesCL', 'urls')
        .exec(function (err, customerStory) {
            if (err) {
                return callback(err, null);
            }
            if (!imageId) {
                return callback(err, customerStory.imagesCL);
            }
            return callback(err, customerStory.imagesCL.id(imageId));
        });
}

exports.getImagesCL = function (req, res) {
    if (!req.params.id) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    findImagesCL(req.params.id, req.params.imageId || null, function (err, images) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        // if imageId is null then images will be an array of image Object or else image Object
        return res.status(200).send(images);
    });
}