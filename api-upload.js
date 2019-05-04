const aws = require('aws-sdk');
const db = require('./queries');
const debug = require('debug')('sitepower.io-backend:api-upload');
aws.config.update({
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    accessKeyId: process.env.ACCESS_KEY_ID
});
var s3 = new aws.S3();

module.exports = function (app, authMiddleware) {
    app.post("/api/upload"/*, authMiddleware*/, (req, res) => {
        /*TODO : убрать*/
        res.header("Access-Control-Allow-Origin", req.headers.origin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        debug("/api/upload", req);
        req.pipe(req.busboy);
        req.busboy.on('file', function (fieldname, file, filename) {
            console.log("Uploading: " + filename);
            const key = Date.now()+"_" + filename
            const params = {
                Bucket: 'files.sitepower.io',
                Body : file,
                Key : key
            };
            s3.upload(params, function (err, data) {
                debug("/api/upload", "data");
                if (err) res.send("Error on uploading");
                if (data) {
                    console.log("Uploaded in:", data.Location);
                    db.uploadFile(params.Key, filename).then(r => res.send({url:"http://" + process.env.DOMAIN + "/api/download/" + r.uuid, file:filename})).catch(err => {
                        console.log(err.message);
                        res.send("Error on uploading")
                    });
                }
            });

        });
    });
    app.get("/api/download/:id", authMiddleware, (req, res) => {
        db.getFileByUUId(req.params.id).then(r => {
                const key = r.key;
                const options = {
                    Bucket    : 'files.sitepower.io',
                    Key       : key,
                };
                s3.headObject(options, function (err, metadata) {
                    if (err && err.code === 'NotFound') {
                        res.status(400).send(`
                            <!doctype html>
                            <html lang="en">
                            <head>
                                <meta charset="utf-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
                                <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css">
                                <title>sitepower.io</title>
                            </head>
                            <body>
                            <div class="main">
                                <div class="container">
                                    <div class="row alert-msg justify-content-center align-items-center">
                                        <div class="col-lg-6 text-center">
                                            <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDMuMzY2IiBoZWlnaHQ9IjQ2Ny4yMjciIHZpZXdCb3g9IjAgMCA0MDMuMzY2IDQ2Ny4yMjciPg0KICA8ZyBpZD0iaGFwcHkiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC02MS44MTcgLTE3LjM4NykiPg0KICAgIDxnIGlkPSJHcm91cF8xIiBkYXRhLW5hbWU9Ikdyb3VwIDEiPg0KICAgICAgPHBhdGggaWQ9IlBhdGhfMSIgZGF0YS1uYW1lPSJQYXRoIDEiIGQ9Ik0yMzEuODYsMTIyLjE0OEExNzAuMDQ0LDE3MC4wNDQsMCwwLDAsMTI5LjQzLDQyNy45MjNjLTEwLjQ4NSwxMy4yODItMjYuMDM0LDI0LjY2My00OS4wOTMsMjkuNzYzLTguMTUsMS44LTkuMiwxMy4wMTYtMS40NTEsMTYuMTE4LDI5LjAyMywxMS42MTcsNzguNDA3LDIxLjY4OCwxMjYuMzgyLTEzLjY0NEExNzAuMDUxLDE3MC4wNTEsMCwxLDAsMjMxLjg2LDEyMi4xNDhaIiBmaWxsPSIjZmZkNTUxIi8+DQogICAgPC9nPg0KICAgIDxnIGlkPSJHcm91cF8yIiBkYXRhLW5hbWU9Ikdyb3VwIDIiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQ2NC4wMzQgNzI0LjI0KSByb3RhdGUoMTgwKSI+DQogICAgICA8cGF0aCBpZD0iUGF0aF8yIiBkYXRhLW5hbWU9IlBhdGggMiIgZD0iTTMwMC4xNDYsMzQyLjE3M2MtMi40MTcsOC42LTguOCwxNy4yNzUtOC44LDE3LjI3NS0yNS4xODEsMzEuNDQ0LTU5LjU3MiwyNi41ODktNTkuNTcyLDI2LjU4OS00OS4yNzQtLjc0OC02NC4wMTktMzEuODkyLTY3LjgzNy00My42NjJhMy4zODYsMy4zODYsMCwwLDEsMy4yMTQtNC40NDJIMjk2Ljg3NEEzLjM2OSwzLjM2OSwwLDAsMSwzMDAuMTQ2LDM0Mi4xNzNaIiBmaWxsPSIjZmZhNzMwIi8+DQogICAgPC9nPg0KICAgIDxnIGlkPSJHcm91cF8zIiBkYXRhLW5hbWU9Ikdyb3VwIDMiPg0KICAgICAgPHBhdGggaWQ9IlBhdGhfMyIgZGF0YS1uYW1lPSJQYXRoIDMiIGQ9Ik0xMTcuNzkxLDQ4Mi4yNmMtNy43NDktMy4xLTYuNy0xNC4zMTYsMS40NTEtMTYuMTE4LDIzLjA1OS01LjEsMzguNjA3LTE2LjQ4LDQ5LjA5My0yOS43NjNBMTcwLjA0NCwxNzAuMDQ0LDAsMCwxLDI3MC43NjUsMTMwLjZjNS41ODksMCwxMS4xMTMuMjc4LDE2LjU2NC44YTE3MC4wNjQsMTcwLjA2NCwwLDAsMC0xNTcuOSwyOTYuNTEyQzExOC45NDUsNDQxLjIsMTAzLjQsNDUyLjU4NCw4MC4zMzcsNDU3LjY4NGMtOC4xNSwxLjgtOS4yLDEzLjAxNi0xLjQ1MSwxNi4xMThhMTQ5LjA3NCwxNDkuMDc0LDAsMCwwLDQ0LjE4OSwxMC40NjVRMTIwLjMzNiw0ODMuMjgxLDExNy43OTEsNDgyLjI2WiIgZmlsbD0iI2ZmYzM0YyIvPg0KICAgIDwvZz4NCiAgICA8ZyBpZD0iR3JvdXBfNCIgZGF0YS1uYW1lPSJHcm91cCA0Ij4NCiAgICAgIDxwYXRoIGlkPSJQYXRoXzQiIGRhdGEtbmFtZT0iUGF0aCA0IiBkPSJNMTA0LjE5MywyODQuMDg3Yy0uMzI1LDAtLjY1MS0uMDE2LS45ODEtLjA0OGExMCwxMCwwLDAsMS04Ljk4My0xMC45MjNjLjgzMy04LjU0MSw2Ljg3Mi0xNy4xMTgsOC4wNzUtMTguNzVxLjEyLS4xNjMuMjQ2LS4zMjFhNTQuMjExLDU0LjIxMSwwLDAsMSw0Ni42MTQtMjAuNzgyYzM3LjAxNC43NzEsNTEuMTYxLDI1Ljg3OSw1My40NywzOS4xbC0xOS43LDMuNDQxLjAyMS4xMTNjLS40NTQtMi4yNzMtNS4yNzgtMjIuMjIzLTM0LjU2NC0yMi42NjhhNy40MzYsNy40MzYsMCwwLDEtMS4yLS4wOWMtMS4yMzYtLjEzNi0xNi45NDctMS41My0yOC44ODIsMTMuMjA2LTEuODMzLDIuNTYzLTMuOTc4LDYuNzEyLTQuMTcsOC42ODlBMTAuMDA1LDEwLjAwNSwwLDAsMSwxMDQuMTkzLDI4NC4wODdaIiBmaWxsPSIjYTU2MDIxIi8+DQogICAgPC9nPg0KICAgIDxnIGlkPSJHcm91cF81IiBkYXRhLW5hbWU9Ikdyb3VwIDUiPg0KICAgICAgPHBhdGggaWQ9IlBhdGhfNSIgZGF0YS1uYW1lPSJQYXRoIDUiIGQ9Ik0yNzYuODk0LDI4NC4wODdjLS4zMjUsMC0uNjUxLS4wMTYtLjk4MS0uMDQ4YTEwLDEwLDAsMCwxLTguOTgzLTEwLjkyM2MuODMzLTguNTQxLDYuODcyLTE3LjExOCw4LjA3NS0xOC43NXEuMTItLjE2My4yNDYtLjMyMWE1NC4yMSw1NC4yMSwwLDAsMSw0Ni42MTQtMjAuNzgyYzM3LjAxNC43NzEsNTEuMTYsMjUuODgsNTMuNDY5LDM5LjFsLTE5LjcsMy40NC4wMjEuMTEzYy0uNDU0LTIuMjczLTUuMjc3LTIyLjIyMy0zNC41NjMtMjIuNjY4YTcuNDM1LDcuNDM1LDAsMCwxLTEuMi0uMDljLTEuMjM4LS4xMzYtMTYuOTQ4LTEuNTI5LTI4Ljg4MiwxMy4yMDYtMS44MzMsMi41NjMtMy45NzgsNi43MTItNC4xNyw4LjY4OEExMC4wMDcsMTAuMDA3LDAsMCwxLDI3Ni44OTQsMjg0LjA4N1oiIGZpbGw9IiNhNTYwMjEiLz4NCiAgICA8L2c+DQogICAgPGcgaWQ9Ikdyb3VwXzYiIGRhdGEtbmFtZT0iR3JvdXAgNiI+DQogICAgICA8cGF0aCBpZD0iUGF0aF82IiBkYXRhLW5hbWU9IlBhdGggNiIgZD0iTTM1OC42NDksMjE3LjM3NmE2LDYsMCwwLDEtNS41MDYtMy42MWMtMTcuODQtNDEuMDQ3LTY5Ljc0Ny01OS4wMDgtNzAuMjctNTkuMTg1YTYsNiwwLDAsMSwzLjgzMS0xMS4zNzJjMi4zMzYuNzg2LDU3LjQ1MiwxOS43NzYsNzcuNDQ0LDY1Ljc3NGE2LDYsMCwwLDEtNS41LDguMzkzWiIgZmlsbD0iI2ZjZTU3NSIvPg0KICAgIDwvZz4NCiAgICA8ZyBpZD0iR3JvdXBfNyIgZGF0YS1uYW1lPSJHcm91cCA3Ij4NCiAgICAgIDxjaXJjbGUgaWQ9IkVsbGlwc2VfMSIgZGF0YS1uYW1lPSJFbGxpcHNlIDEiIGN4PSIxMy4zNzYiIGN5PSIxMy4zNzYiIHI9IjEzLjM3NiIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjE0LjE4NSAxNTEuMzAyKSIgZmlsbD0iI2ZmYzM0YyIvPg0KICAgIDwvZz4NCiAgICA8ZyBpZD0iR3JvdXBfOCIgZGF0YS1uYW1lPSJHcm91cCA4Ij4NCiAgICAgIDxwYXRoIGlkPSJQYXRoXzciIGRhdGEtbmFtZT0iUGF0aCA3IiBkPSJNMzMxLjkyMywxMjguNTQ5aDBBMTUuMjA3LDE1LjIwNywwLDAsMSwzMjcsMTA3LjYxNGwzMy44MTgtNTQuNmExNS4yMDcsMTUuMjA3LDAsMCwxLDIwLjkzNS00LjkyMWgwYTE1LjIwNywxNS4yMDcsMCwwLDEsNC45MjEsMjAuOTM1bC0zMy44MTgsNTQuNkExNS4yMDcsMTUuMjA3LDAsMCwxLDMzMS45MjMsMTI4LjU0OVoiIGZpbGw9IiNmZmRmNzQiLz4NCiAgICA8L2c+DQogICAgPGcgaWQ9Ikdyb3VwXzkiIGRhdGEtbmFtZT0iR3JvdXAgOSI+DQogICAgICA8cGF0aCBpZD0iUGF0aF84IiBkYXRhLW5hbWU9IlBhdGggOCIgZD0iTTM3Mi42NDgsMTY4LjU4MWgwQTE1LjIwNywxNS4yMDcsMCwwLDEsMzgzLjk3MiwxNTAuM0w0NDYuNDkzLDEzNS42YTE1LjIwNywxNS4yMDcsMCwwLDEsMTguMjgzLDExLjMyNGgwYTE1LjIwNywxNS4yMDcsMCwwLDEtMTEuMzI0LDE4LjI4M0wzOTAuOTMxLDE3OS45QTE1LjIwOCwxNS4yMDgsMCwwLDEsMzcyLjY0OCwxNjguNTgxWiIgZmlsbD0iI2ZmZGY3NCIvPg0KICAgIDwvZz4NCiAgICA8ZyBpZD0iR3JvdXBfMTAiIGRhdGEtbmFtZT0iR3JvdXAgMTAiPg0KICAgICAgPHBhdGggaWQ9IlBhdGhfOSIgZGF0YS1uYW1lPSJQYXRoIDkiIGQ9Ik0yNzcuOTQxLDEwOS45MjJoMEExNS4yMDcsMTUuMjA3LDAsMCwxLDI1OS42NTgsOTguNmwtMTQuNy02Mi41MjFhMTUuMjA3LDE1LjIwNywwLDAsMSwxMS4zMjQtMTguMjgzaDBBMTUuMjA3LDE1LjIwNywwLDAsMSwyNzQuNTcsMjkuMTE4bDE0LjcsNjIuNTIxQTE1LjIwNywxNS4yMDcsMCwwLDEsMjc3Ljk0MSwxMDkuOTIyWiIgZmlsbD0iI2ZmZGY3NCIvPg0KICAgIDwvZz4NCiAgPC9nPg0KPC9zdmc+DQo=" alt="Error">
                                            <p>Возникла ошибка при получении данных с сервера.</p>
                                            <p>Истёк срок жизни файла (24 часа) и он был автоматически удалён с сервера</p>
                                            <hr>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </body>
                            </html>
                        `)
                    } else {
                        res.attachment(r.filename);
                        const fileStream = s3.getObject(options).createReadStream();
                        fileStream.pipe(res);
                    }
                });
        }).catch(err => {
            console.log(err.message);
            res.status(400).send("Error on downloading")
        });
    })

}
