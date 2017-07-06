// SAMPLE CODE

var mongoose = require('mongoose');

// INFO: Db Schema is not attached with this repo
var Service = require('./dbSchema/Service');
var FileMap = require('./dbSchema/FileMap');

// TODO: Use Logger


/**
 * function can be used to build service match query
 * helper function
 * @param {string} id                              - mongoose id, shortId or urlStr
 * @return {Object} matchQuery                     - match query object,eg. {$or: [{shortId: id}, {urlStr: id}]} or {_id: id}
 */
function buildServiceMatchQuery(id) {
    var matchQuery = {};
    try {
        if ((new mongoose.Types.ObjectId(id)).toString() === id) {
            matchQuery['_id'] = id;
        } else {
            matchQuery['$or'] = [{ urlStr: id }, { shortId: id }];
        }
    } catch (e) {
        matchQuery['$or'] = [{ urlStr: id }, { shortId: id }];
    }
    return matchQuery;
}

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
 * @property {number} page_size                 - Number of results to show in a page, optional?
 * @property {number} page_number               - Page number, optional?
 */
/**
 * @typedef {Object} FindServicesOptions
 * @property {string} select                    - comma or sapce separated properties
 * @property {Pagination} pagination            - pagination object, contains page_size and page_number
 */
/**
 * @callback GetServicesCallback
 * @param {Object} err                          - db error
 * @param {Object} services                     - Array of Service
 */
/**
 * @description                                   findServices function can be used to fetch Services
 * @param {Object} q                            - Provide mogoDB match query, eg. {name: 'some name', type: 'catering', ..., propN: 'valueN'}
 * @param {FindServicesOptions} [options]       - optional, contains pagination and select
 * @param {GetServicesCallback} callback        - Callback function
 */
function findServices(q, options, callback) {
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

    Service
        .find(q)
        .select(selection.toString())
        .skip(toSkip)
        .limit(pagination.page_size)
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .lean()
        .exec(function (err, services) {
            if (err) {
                return callback(err);
            }
            Service.count(q, function (err, count) {
                var totalPage = Math.ceil(count / pagination['page_size']);
                var next = (pagination['page_number'] + 1 < totalPage) ? pagination['page_number'] + 1 : undefined;
                var previous = (pagination['page_number'] > 1) ? pagination['page_number'] - 1 : undefined;
                return callback(null, { services: services, pagination: { count: count, totalPage: totalPage, next: next, previous: previous } });
            });
        });
}


/**
 * export this function, so that it can be called from anywhere
 * INFO: All authentication should be done in middleware 
 */
exports.findServices = findServices;
exports.getServices = function (req, res) {
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
    findServices(q, { select: select || undefined, pagination: pagination || undefined }, function (err, results) {
        if (err) {
            console.log("getServices: " + JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send({ services: results.services, pagination: results.pagination, message: "done" });
    });
}




/**
 * @callback FindServiceCallback
 * @param {Object} err                                  - DB Error
 * @param {Object} service                              - Service Object
 */
/**
 * @typedef {Object} FindServiceOptions
 * @property {string} select                            - comma or sapace separated properties
 */
/**
 * @description                                           find service by Id or urlStr
 * @param {string} id                                   - mongoose id, shortId or urlStr. (urlStr => 'abc-catering-service-SHORTID');
 * @param {FindServiceOptions} [options]                - options *optional  
 * @param {FindServiceCallback} callback                - Callback function (err, service)
 */
function findService(id, options, callback) {
    // since options is an optional field;
    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : "";

    if (!id) {
        return callback(new Error("Service Id is missing"));
    }

    var matchQuery = buildServiceMatchQuery(id) || {};

    if (Object.keys(matchQuery).length === 0) {
        // failed to build serviceMatchQuery
        console.log("findService: failed to build serviceMatchQuery");
        return callback(new Error("failed to build service match query"));
    }

    var selection = '';
    if (options.select) {
        selection = select.replace(/,/g, ' ');
    }
    Service
        .findOne(matchQuery)
        .select(selection.toString())
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .lean()
        .exec(function (err, service) {
            return callback(err, service);
        });
}

/**
 * exposed this function so that it can be reused
 * INFO: All authentication should be done in middleware
 */
exports.findService = findService;
exports.getService = function (req, res) {
    var id = req.params.id || null;
    var options = { select: req.query.select || "" };
    findService(id, options, function (err, service) {
        if (err) {
            console.log("getService", JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        if (!service.show) {
            console.log("Hidden Service", service._id);
            return res.status(404).send({ message: "Page not found" });
        }
        return res.status(200).send({ message: "done", service: service });
    });
}

/**
 * @callback CreateServiceCallback
 * @property {Object} err                                                   - Db Error
 * @property {Object} service                                               - new Service Document
 */
/**
 * To Create a new Service
 * @param {Object} service                                                  - Service document
 * @param {CreateServiceCallback} callback                                  - callback function(err, service);
 */
function createService(service, callback) {

    var images = [];
    if (!!service.imagesCL && !!service.imagesCL.length) {
        images = images.concat(service.imagesCL);
    }
    if (!!service.showcases && !!service.showcases.length) {
        service.showcases.forEach(function (showcase) {
            if (!!showcase.imagesCL && !!showcase.imagesCL.length) {
                images = images.concat(showcase.imagesCL);
            }
        }, this);
    }

    var newService = new Service(service);
    newService.save(function (err, _service) {
        if (!err) {
            updateFileMap(images, { mappedStatus: true });
        }
        return callback(err, _service);
    });
}

/**
 * INFO: All authentication should be done in middleware
 */
exports.postService = function (req, res) {
    if (!req.body.service) {
        return res.status(400).send({ message: "Bad Request" });
    }
    createService(req.body.service, function (err, service) {
        if (err) {
            console.log("postService: ", JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal Server Error" });
        }
        return res.status(200).send(service);
    });
}



/**
 * @callback updateServiceCallback
 * @property {Object} err                                                   - DB Error
 * @property {Object} service                                               - service object after update
 */
/**
 * updateService can be used to update service doc
 * this function expects entire service doc, it is similar as put request
 * @param {Object} service                                                  - entire service doc with all updates
 * @param {updateServiceCallback} callback                                  - callback function(err, service)
 */
function updateService(service, callback) {
    if (!service._id) {
        return callback(new Error("_id property is missing from the service object"));
    }

    // imagesCl can't be patched or updated here, 
    delete service.imagesCL;
    if (service.showcases) {
        service.showcases.forEach(function (showcase) {
            delete showcase.imagesCL
        }, this);
    }

    Service
        .findByIdAndUpdate(service._id.toString(), service, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            return callback(err, service);
        });
}


/**
 * export updateService function
 * INFO: All authentication should be done in middleware
 */
exports.updateService = updateService;


exports.putService = function (req, res) {

    if (!req.body.service || !req.body.service._id) {
        return res.status(400).send({ message: "Bad Request" });
    }

    updateService(req.body.service, function (err, service) {
        if (err) {
            console.log("putService: ", JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal server error" });
        }
        return res.status(200).send({ service: service });
    });
}


/**
 * to update service document, same as Patch request
 * @param {string} id                                                                       - service id
 * @param {Object} patchObject                                                              - Patch object, eg. {name: name, riders: ['1. some text', '2. text2']}
 * @param {ModifyServiceCallback} callback                                                  - callback function(err, service)
 */
function modifyService(id, patchObject, callback) {
    delete patchObject['showcases'];
    delete patchObject['imagesCL'];
    Service
        .findByIdAndUpdate(id, patchObject, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            return callback(err, service);
        });

}

exports.patchService = function (req, res) {
    if (!req.params.id || req.body.payload) {
        return res.status(400).send({ message: 'Bad Request', eId: 'BREQ' });
    }
    modifyService(req.params.id, req.body.payload, function (err, service) {
        if (err) {
            return res.status(500).send({ message: 'Internal Server Error', eId: 'DBE' });
        }
        return res.status(200).send(service);
    });
}



/**
 * @callback findShowcaseCallback
 * @property {Object} err                                               - DB Error
 * @property {Object|Object.Array} showcase                             - showcase or array of showcases, depends on the options given 
 */
/**
 * 2 params
 * @typedef {Object} FindShowcaseOptions
 * @property {string} showcaseId                                        - mongoose id, if showcaseId is passed then it will return that specific showcase(Object) or else Array of showcase
 * @property {string} select                                            - comma or space separated properties, optional?
 */
/**
 * findShowcases function returns showcase. 
 * expects service identifier(mongoose id, shortId or urlStr). 
 * @param {string} id                                                    - mongoose id, shortId or urlStr
 * @param {FindShowcaseOptions} [options]                                - optionals properties like {showcaseId: '', select: ''}, optional?
 * @param {findShowcaseCallback} callback                                - callback function(err, showcases);
 */
function findShowcases(id, options, callback) {

    callback = typeof callback === 'function' ? callback : options;
    options = options || {};

    var selection = options.select ? options.select.replace(/,/g, ' ') : ' ';
    selection += ' showcases';  // default select 

    if (!id) {
        return callback(new Error("Service identifier is missing"));
    }

    var matchQuery = buildServiceMatchQuery(id) || {};
    if (Object.keys(matchQuery).length === 0) {
        // failed to build serviceMatchQuery
        console.log("findService: failed to build serviceMatchQuery");
        return callback(new Error("failed to build service match query"));
    }

    Service
        .findOne(matchQuery)
        .select(selection)
        .lean()
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            if (err) {
                return callback(err, null);
            }
            if (!service || !service.showcases || !Array.isArray(service.showcases)) {
                return callback(new Error("either service or showcase is not available"));
            }
            if (options.showcaseId) {
                var showcase = {};
                service.showcases.some(function (tmp, index) {
                    if (tmp.id.toString() === options.showcaseId) {
                        showcase = tmp;
                        return true;
                    }
                });
                return callback(null, showcase);
            }
            return callback(null, service.showcases);
        });
}


exports.findShowcases = findShowcases;

/**
 * getShowcases function, 
 * expects id in request params, 
 * showcaseId as second params in request, optional?. 
 * select in request query, optional?.
 */
exports.getShowcases = function (req, res) {
    if (!req.params.id) {
        return res.status(400).send({ message: "Bad request" })
    }
    findShowcases(req.params.id, { showcaseId: req.params.showcaseId || null, select: req.query.select || " " }, function (err, showcases) {
        if (err) {
            console.log("getShowcases: ", JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal Server Error" });
        }
        if (!showcases) {
            return res.status(404).send({ message: "page not found" });
        }
        return res.status(200).send({ showcases: showcases, id: req.params.id });
    });
}

/**
 * @typedef {Object} CreateShowcasesOptions
 * @property {string} [lastModifiedBy]                          - userId of the user who is taking this action, this is required for the proper functioning of email and sms notifications
 */
/**
 * @callback CreateShowcasesCallback
 * @property {Object} err                                       - Db Error
 * @property {Object} service                                   - Service document after update
 */
/**
 * createShowcase function can be used to push a new showcase in existing service
 * this function expects service identifier and new showcase object
 * @param {string} id                                           - Service Identifier(_id, shortId or urlStr), 
 * @param {Object} showcase                                     - New Showcase Object
 * @param {CreateShowcasesOptions} [options]                    - options, optional param, it can be used to pass the user id of the user(lastModifiedBy), who is taking the action. 
 * @param {CreateShowcasesCallback} callback                    - callback function(err, service)
 */
function createShowcases(id, showcase, options, callback) {
    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : {};

    // To update the FileMap Collection
    var images = showcase['imagesCL'] || null;

    var newData = { $push: { showcases: showcase } };
    if (options.lastModifiedBy) {
        newData['lastModifiedBy'] = options.lastModifiedBy;
    }

    Service
        .findByIdAndUpdate(id, newData, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            if (!err) {
                updateFileMap(images, { mappedStatus: true });
            }
            return callback(err, service);
        });
}
/**
 * expects service _id in request params(id) and new showcase in request body 
 */
exports.postShowcases = function (req, res) {
    if (!req.params.id || !req.body.showcase) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }
    // TODO: use a middleware, which will attach the userId in req
    var userId = req.userId || undefined;

    createShowcases(req.params.id, req.body.showcase, { lastModifiedBy: userId }, function (err, service) {
        if (err) {
            console.log("postShowcases: ", JSON.stringify(err, null, 2));
        }
        return res.status(200).send(service);
    });
}



/**
 * @callback UpdateShowcasesCallback
 * @property {Object} err                                           - Db Error
 * @property {Object} service                                       - service documement after update
 */
/**
 * to update a showcase doc entirely, similar as put request
 * @param {string} id                                               - service id(_id)
 * @param {Object} showcase                                         - showcase object with updated value 
 * @param {Object} [options]                                        - optional
 * @param {string} options.lastModifiedBy                           - userId
 * @param {UpdateShowcasesCallback} callback                        - callback function(err, service)
 */
function updateShowcases(id, showcase, options, callback) {
    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : {};

    // imagesCL Can't be updated here
    delete showcase.imagesCL;

    Service
        .findOneAndUpdate({ _id: id, 'showcases._id': showcase._id }, { 'showcases.$': showcase }, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            return callback(err, service);
        });
}


exports.putShowcases = function (req, res) {
    if (!req.params.id || !req.params.showcaseId || req.body.showcase) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }

    updateShowcases(req.params.id, req.body.showcase, { lastModifiedBy: req.userId || undefined }, function (err, service) {
        if (err) {
            console.log("putShowcase: ", JSON.stringify(err, null, 2));
            return res.status(200).send(service);
        }
    });
}


/**
 * @callback ModifyShowcaseCallback
 * @property {Object} err                                                   - Db Error
 * @property {Object} service                                               - Service doc
 */
/**
 * there can be multiple path and multiple value
 * @typedef {Object} PROPS
 * @property {string} path1                                                 - path/property thats needs to be updated 
 * @property {string} value1                                                - New Value 
 */
/**
 * this function can be used to update show partially, equivalent to patch request
 * @param {string} id                                                       - Service id(_id)
 * @param {string} showcaseId                                               - ShowcaseId(_id)
 * @param {PROPS} props                                                     - an Object with patch values, eg. {name:'name', path: 'value' ... , pathN: 'valueN'}      
 * @param {Object} [options]                                                - Optinal Params, it can be used to pass optinal values like lastModifiedBy 
 * @param {ModifyShowcaseCallback} callback                                 - callback function(err, service)
 */
function modifyShowcases(id, showcaseId, props, options, callback) {

    callback = typeof callback === 'function' ? callback : options;
    options = typeof options === 'object' ? options : {};

    var newData = {};
    var propsCantBePatched = ['imagesCL', 'filters'];

    for (var key in props) {
        if (propsCantBePatched.indexOf(key) !== -1) continue;
        newData['showcases.$' + key] = props[key];
    }
    if (options && options.lastModifiedBy) {
        newData['lastModifiedBy'] = options.lastModifiedBy;
    }

    Service.findOneAndUpdate({ _id: id, 'showcases._id': showcaseId }, newData)
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            return callback(err, service);
        });
}

exports.patchShowcases = function (req, res) {

    // req.user will be present,

    if (!req.params.id || !req.params.showcaseId || !req.body.payload) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" })
    }


    modifyShowcases(req.params.id, req.params.showcaseId, req.body.payload, { lastModifiedBy: req.user._id || null }, function (err, service) {
        if (err) {
            console.log("patchShowcase: ", JSON.stringify(err, null, 2));
            return res.status(500).send({ message: "Internal server Error", eId: "DBE" });
        }
        return res.status(200).send(service);
    });
}


/**
 * @callback RemoveShowcaseCallback
 * @property {Object} err                                               - Db Error
 */
/**
 * Remove Showcase 
 * @param {string} id                                                   - Service Id (_id)
 * @param {string} showcaseId                                           - Showcase Id (_id)
 * @param {RemoveShowcaseCallback} callback                             - callback function(err)
 */
function removeShowcases(id, showcaseId, callback) {
    var images;
    Service
        .findById(id)
        .select('showcases')
        .exec(function (err, service) {
            images = service.showcases.id(showcaseId).imagesCL;
            service.showcases.id(showcaseId).remove();
            service.save(function (err) {
                // Update FileMap Collection
                if (!err) {
                    updateFileMap(images, { markedAsDelete: true });
                }
                return callback(err);
            });
        });
}

exports.deleteShowcase = function (req, res) {
    if (!req.params.id || !req.params.showcaseId) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }

    removeShowcases(req.params.id, req.params.showcaseId, function (err) {
        if (err) {
            return res.status(500).send({ message: "Internal Server Error", eId: 'DBE' });
        }
        return res.status(200).send({ message: "Showcase Removed" });
    });

}


/**
 * @callback CreateImagesCLCallback
 * @property {Object} err                                           - Db Error
 * @property {Object} service                                       - Service Document after update
 */
/**
 * to push new service Image
 * @param {string} id                                               - Service id(_id)
 * @param {string|Array.string} imageIds                            - fileMap id or array of ids
 * @param {CreateImagesCLCallback} callback                         - callback function(err, service);
 */
function createImagesCL(id, imageIds, callback) {
    // Check if its an array
    if (imageIds && !Array.isArray(imageIds)) {
        imageIds = [imageIds];
    }
    Service
        .findByIdAndUpdate(id, { $push: { imagesCL: { $each: imageIds } } }, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', urls)
        .exec(function (err, service) {
            if (!err) {
                updateFileMap(imageIds, { mappedStatus: true });
            }
            return callback(err, service);
        });
}

exports.postImagesCL = function (req, res) {
    if (!req.params.id || !req.body.imagesCL) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }
    createImagesCL(req.params.id, req.body.imagesCL, function (err, service) {
        if (err) {
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send(service);
    });
}

/**
 * @callback RemoveImagesCLCallback
 * @property {Object} err                                               - Db Error
 * @property {Object} service                                           - Service Doucument after update
 */
/**
 * Delete images from service
 * @param {string} id                                                   - service id
 * @param {string|Array.string} imageIds                                - imageId or array of imageIds
 * @param {RemoveImagesCLCallback} callback                             - callback function(err, service)
 */
function removeImagesCl(id, imageIds, callback) {
    if (imageIds && !Array.isArray(imageIds)) {
        imageIds = [imageIds];
    }
    Service
        .findByIdAndUpdate(id, { $pull: { imagesCL: { $in: imageIds } } }, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', urls)
        .exec(function (err, service) {
            if (!err) {
                updateFileMap(imageIds, { markedAsDelete: true });
            }
            return callback(err, service);
        });
}


exports.deleteImagesCL = function (req, res) {
    if (!req.params.id || !req.params.imageId) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }
    removeImagesCL(req.params.id, req.params.imageId, function (err, service) {
        if (err) {
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send(service);
    });
}


/**
 * @callback createShowcasesImagesCL
 * @property {Object} err                                               - Db Error
 * @property {Object} service                                           - Service document after update
 */
/**
 * Add new showcase image       
 * @param {string} id                                                   - Service id(_id)
 * @param {string} showcaseId                                           - Showcase id(_id)
 * @param {string|Array.string} imageIds                                - image Id(FileMap Id) or array of Ids 
 * @param {CreateShowcasesImagesCL} callback                            - callback function (err, service)
 */
function createShowcasesImagesCL(id, showcaseId, imageIds, callback) {
    if (imageIds && !Array.isArray(imageIds)) {
        imageIds = [imageIds];
    }
    Service
        .findOneAndUpdate({ _id: id, 'showcases._id': showcaseId }, { $push: { 'showcases.$.imagesCL': { $each: imageIds } } }, { new: true })
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', 'urls')
        .exec(function (err, service) {
            if (!err) {
                updateFileMap(imageIds, { mappedStatus: true });
            }
            return callback(err, service);
        });
}

exports.postShowcasesImagesCL = function (req, res) {
    if (!req.params.id || !req.params.showcaseId || !req.body.imagesCL) {
        return res.status(400).send({ message: "Bad Request", eId: "BREQ" });
    }
    createShowcasesImagesCL(req.params.id, req.params.showcaseId, req.body.imagesCL, function (err, service) {
        if (err) {
            return res.status(500).send({ message: "Internal Server Error", eId: "DBE" });
        }
        return res.status(200).send(service);
    });
}


/**
 * @callback RemoveShowcasesImagesCLCallback
 * @property {Object} err                                               - Db Error
 * @property {Object} service                                           - Service Document after update
 */
/**
 * To delete showcase image
 * @param {string} id - Service Id(_id)
 * @param {string} showcaseId - Showcase Id(_id)
 * @param {string|Array.string} imageIds - imageId or array of imageIds to be deleted   
 * @param {RemoveShowcasesImagesCLCallback} callback - callback function(err, service)
 */
function removeShowcasesImagesCL(id, showcaseId, imageIds, callback) {
    if (imageIds && !Array.isArray(imageIds)) {
        imageIds = [imageIds];
    }
    Service
        .findOneAndUpdate(
        { _id: id, 'showcases._id': showcaseId },
        { $pull: { 'showcases.$.imagesCL': { $in: imageIds } } },
        { new: true }
        )
        .populate('imagesCL', 'urls')
        .populate('showcases.imagesCL', urls)
        .exec(function (err, service) {
            if (!err) {
                updateFileMap(imageIds, { markedAsDelete: true });
            }
            return callback(err, service);
        });
}


exports.deleteShowcasesImagesCL = function (req, res) {
    if (!req.params.id || !req.params.showcaseId || !req.params.imageId) {
        return res.status(400).send({ message: 'Bad Request' })
    }
    removeShowcasesImagesCL(req.params.id, req.params.showcaseId, req.params.imageId,
        function (err, service) {
            if (err) {
                return res.status(500).send({ message: 'Internal Server Error' });
            }
            return res.status(200).send(service);
        });
}