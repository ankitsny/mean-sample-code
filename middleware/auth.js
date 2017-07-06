// SAMPLE CODE


exports.checkRoles = function (roles) {
    return function (req, res, next) {
        var access_token = req.headers.access_token;

        if (!access_token) return res.status(400).send({ message: "Bad Request" });

        // TODO: decrypt access_token using key(JWT) and restore the hidden values
        // chek for authenticity of token and roles of the user
        // if(!authorized) return res.status(401).send({message:"Unauthorized"});

        // return next();
    }
}

exports.isValidToken = function (req, res, next) {
    var access_token = req.headers.access_token;

    if (hasTokenExpired(access_token))
        return res.status(401).send({ message: "Token Expired" });

    return next();
}

function hasTokenExpired(token) {
    if (!token) return true;

    // TODO: decrypt access_token using key and restore the hidden values
    // if valid token then return false
    // else return true
}