const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')

const MAGMAESDM_REPORTURL = "https://magma.esdm.go.id/v1/gunung-api/informasi-letusan"
const LASTEVENTCHANGE     = `${process.cwd()}/last.txt`
const CRASHFILEGENERATE   = `${process.cwd()}/crash.txt`
const DEFAULT_HEADER      = {
  'Accept': 'application/json, txt/plain, */*',
  'Content-Type': '*/*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"'
}

const removeAttributesContent = (texts) => {
  let txt = ""
  for(let a of texts.split("\n")) {
    if(!!a.trim()) {
      txt += `\n${a}`
    }
  }
  return txt.trim()
}

async function GetLastInformation() {
  try {
    const data = await axios.get(`${MAGMAESDM_REPORTURL}`, {
      headers: DEFAULT_HEADER
    })
    if(!data.headers['content-type'].match('text/html')) {
      return {
        error: `This content is not html, this format is ${data.headers['content-type']}, please check or report this version for updateable`
      }
    }
    const $ = cheerio.load(data.data)
    const last_content_date = $('div.timeline-group div.timeline-item').eq(0)
    const last_content_short = $('div.timeline-group div.timeline-item').eq(1)
    const returnExport = {
      time: $(".timeline-date", last_content_date).text().trim()+"/"+$(".timeline-time", last_content_short).text().trim(),
      volcano: $("div.timeline-body p.timeline-title a", last_content_short).text().trim(),
      author: $("div.timeline-body p.timeline-author a", last_content_short).text().trim(),
      description: removeAttributesContent($("div.timeline-body p.timeline-text", last_content_short).text().trim()),
      image: $("img", $("div.timeline-body div.row.mg-b-15", last_content_short).eq(0)).attr('src') || null,
      id: $("a", $("div.timeline-body div.row.mg-b-15", last_content_short).eq(1)).attr('href').split(new URL(MAGMAESDM_REPORTURL).pathname+"/")[1].replace("/show",""),
    }
    return {
      data: returnExport
    }
  } catch(err) {
    fs.writeFileSync(CRASHFILEGENERATE, `[${new Date().toISOString()} Error]: \n${err.stack}\n${fs.readFileSync(CRASHFILEGENERATE, "utf-8")}`, "utf-8")
    console.log('[GetLastInformation] Error:', err)
    return {
      error: err.message,
      code: "INTERNAL_ERROR",
      status: 500
    }
  }
}

async function GetDetailRequest(uuid) {
  try {
    const data = await axios.get(`${MAGMAESDM_REPORTURL}/${uuid}/show`, {
      headers: DEFAULT_HEADER
    })
    if(!data.headers['content-type'].match('text/html')) {
      return {
        error: `This content is not html, this format is ${data.headers['content-type']}, please check or report this version for updateable`
      }
    }
    const $ = cheerio.load(data.data)
    const returnExport = {
      image: $('.card-blog .no-gutters .img-fit-cover').attr('src') || null,
      date: $('.card-blog .no-gutters .blog-category.tx-danger').text().trim(),
      title: $('.card-blog .no-gutters .blog-title a').eq(0).text().trim(),
      volcano: $('li.breadcrumb-item.active').text().trim(),
      author: $('.card-blog .no-gutters .card-subtitle.tx-normal').text().split(", ")[1].trim(),
      description: $('.card-blog .no-gutters p').eq(2).text().trim(),
      recommendation: removeAttributesContent($('p.blog-text').eq(0).text().trim()).split("\n"),
      view_page: `${MAGMAESDM_REPORTURL}/${uuid}/show`
    }
    return {
      data: returnExport
    }
  } catch(err) {
    fs.writeFileSync(CRASHFILEGENERATE, `[${new Date().toISOString()} Error]: \n${err.stack}\n${fs.readFileSync(CRASHFILEGENERATE, "utf-8")}`, "utf-8")
    console.log('[GetDetailRequest] Error:', err)
    if(err.response) {
      return {
        error: "Server is another responses!",
        code: "RESPONSE_IS_NOT_OK",
        status: 400
      } 
    }
    return {
      error: err.message,
      code: "INTERNAL_ERROR",
      status: 500
    }
  }
}

async function EventTimeNotification(cb) {
  const createSleepTime = (time) => {
    return new Promise((res) => {
      setTimeout(() => res(true), time)
    })
  }

  async function __TimeLoop() {
    console.log("Request...")
    const dataLast = await GetLastInformation()
    if(dataLast.code) {
      // Count down 5 minute
      await createSleepTime(1000*60*5)
      __TimeLoop()
      return;
    }
    // Count down 1 minute
    const readFile = fs.readFileSync(LASTEVENTCHANGE, "utf-8")
    if(readFile != dataLast.data.id) {
      fs.writeFileSync(LASTEVENTCHANGE, dataLast.data.id, "utf-8")
      cb({
        type: "force-notif-content",
        id: dataLast.data.id
      })
    }
    await createSleepTime(1000*60)
    __TimeLoop()
    return;
  }
  __TimeLoop()
}

module.exports = {
  GetDetailRequest,
  GetLastInformation,
  EventTimeNotification
}