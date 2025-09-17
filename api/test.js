module.exports = (req, res) => {
    res.status(200).json({
        message: "API test endpoint working!",
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        path: req.url
    });
};