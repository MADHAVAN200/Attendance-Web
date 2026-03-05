const catchAsync = (fn) => {

    return (req, res, next) => {
        // ensure we always have a promise to attach .catch to
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export default catchAsync;
