const UrlModel = require('../model/urlModel')
const axios = require('axios')
const shortid = require('shortid')
const redis = require("redis");
const { promisify } = require("util");

const isValid = function (value) {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    if (typeof value === 'number' && value.toString().trim().length === 0) return false
    return true;
}
// create a short URL====================================//

const redisClient = redis.createClient(
    17456,
    "redis-17456.c301.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("vZZ1EVOuSk5IAI7ffEGstefqr64pyNiR", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});


//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient)


const createUrl = async function (req, res) {
    try {
        const longUrl1 = req.body

        if (Object.keys(longUrl1).length == 0) { return res.status(400).send({ status: false, message: "please input data in body" }) }

        const { longUrl } = longUrl1//destructure

        if (!isValid(longUrl)) {
            return res.status(400).send({ status: false, message: "Long URL required" })
        }

      

        if (!longUrl) {
            return res.status(400).send({ status: false, message: "please provide required input field" })
        }

        let obj={
            method:"get",
            url:longUrl
        }
        let urlFound=false
        let urlF = await axios(obj).then(()=>urlFound=true).catch(()=>{urlFound=false});
        if(!urlF){
            return res.status(404).send({status:false,message:"Url does not exist"})
        }

        const baseUrl = "http://localhost:3000"

        const cahcedUrlData = await GET_ASYNC(`${longUrl}`)

        let short_url = JSON.parse(cahcedUrlData)
         
        if (short_url) {
            return res.status(200).send({ status: true, data: short_url })
        }

        let urlPresent = await UrlModel.findOne({ longUrl: longUrl }).select({ _id: 0, createdAt: 0, updatedAt: 0, __v: 0 })

        if (urlPresent) {
            await SET_ASYNC(`${longUrl}`, JSON.stringify(urlPresent))
            return res.status(200).send({ status: true, message: " Already Present in database", data: urlPresent })
        }

        const urlCode = shortid.generate().toLowerCase()

        const url = await UrlModel.findOne({ urlCode: urlCode })

        if (url) {

            return res.status(409).send({ status: false, message: "urlCode already exist in tha db" })

        }

        const shortUrl = baseUrl + '/' + urlCode

        const dupshortUrl = await UrlModel.findOne({ shortUrl: shortUrl })

        if (dupshortUrl) {

            return res.status(409).send({ status: false, message: "shortUrl already exist in tha db" })

        }

        const newUrl = {
            longUrl: longUrl,
            shortUrl: shortUrl,
            urlCode: urlCode
        }


        const createUrl = await UrlModel.create(newUrl)

        return res.status(201).send({ status: true, message: "New Url created", data: newUrl })

    }

    catch (err) {

        return res.status(500).send({ status: false, message: err.message })

    }

}



//..............................................get by params.....................................


const geturl = async function (req, res) {
    let urlc = req.params.urlCode

    if (!urlc) {
        return res.status(400).send({ status: false, message: "Urlcode must be present !" })
    }

    let cache = await GET_ASYNC(`${urlc}`)


    cache = JSON.parse(cache)

    if (cache) return res.status(302).redirect(cache.longUrl)

    const checkurl = await UrlModel.findOne({ urlCode: urlc })
    if (!checkurl) {
        return res.status(404).send({ status: false, message: " Url code is not found" })
    }

    await SET_ASYNC(`${urlc}`, JSON.stringify(checkurl))

    return res.status(302).redirect(checkurl.longUrl)


}


module.exports = { createUrl, geturl }