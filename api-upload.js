const aws = require('aws-sdk');
const db = require('./queries');
aws.config.update({
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    accessKeyId: process.env.ACCESS_KEY_ID
});
var s3 = new aws.S3();

module.exports = function (app, authMiddleware) {
    app.post("/api/upload", authMiddleware, (req, res) => {
        const key = Date.now()+"_" + req.body.filename
        const params = {
            Bucket: 'sitepower.io',
            Body : req.body.file,
            Key : key
        };
        s3.upload(params, function (err, data) {
            if (err) res.send("Error on uploading");
            if (data) {
                console.log("Uploaded in:", data.Location);
                db.uploadFile(params.Key, req.body.filename).then(r => res.send("http://" + process.env.DOMAIN + "/api/download/" + r.uuid)).catch(err => {
                    console.log(err.message);
                    res.send("Error on uploading")
                });
            }
        });
    });
    app.get("/api/download/:id", authMiddleware, (req, res) => {
        db.getFileByUUId(req.params.id).then(r => {
            const key = r.key;
            const options = {
                Bucket    : 'sitepower.io',
                Key       : key,
            };
            res.attachment(r.filename);
            const fileStream = s3.getObject(options).createReadStream();
            fileStream.pipe(res);
        }).catch(err => {
            console.log(err.message);
            res.send("Error on downloading")
        });
    })

}