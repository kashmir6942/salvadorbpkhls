/**
 * Cloudflare Worker for converting MPD (MPEG-DASH) streams with DRM clearkey to M3U8 (HLS)
 * Supports automatic channel conversion from MPD with clearkey to HLS format
 */

import { DOMParser } from "@xmldom/xmldom"
import type { ExecutionContext } from "@cloudflare/workers-types"

interface ClearKeyInfo {
  kid: string
  key: string
}

interface ChannelInfo {
  name: string
  logo: string
  group: string
  mpdUrl: string
  clearKey: ClearKeyInfo
}

const CHANNELS: Record<string, ChannelInfo> = {
  // Entertainment
  a2z: {
    name: "A2Z",
    logo: "https://i.imgur.com/ftwsljN.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_a2z/default/index.mpd",
    clearKey: { kid: "f703e4c8ec9041eeb5028ab4248fa094", key: "c22f2162e176eee6273a5d0b68d19530" },
  },
  "one-ph": {
    name: "One PH",
    logo: "https://i.imgur.com/U9QwJSE.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/oneph_sd/default/index.mpd",
    clearKey: { kid: "92834ab4a7e1499b90886c5d49220e46", key: "a7108d9a6cfcc1b7939eb111daf09ab3" },
  },
  buko: {
    name: "Buko",
    logo: "https://i.imgur.com/BxQvEil.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_buko_sd/default/index.mpd",
    clearKey: { kid: "d273c085f2ab4a248e7bfc375229007d", key: "7932354c3a84f7fc1b80efa6bcea0615" },
  },
  "sari-sari": {
    name: "Sari-Sari",
    logo: "https://i.imgur.com/25CGN9g.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_sarisari/default/index.mpd",
    clearKey: { kid: "0a7ab3612f434335aa6e895016d8cd2d", key: "b21654621230ae21714a5cab52daeb9d" },
  },
  "tv5-hd": {
    name: "TV5",
    logo: "https://i.imgur.com/U5L67WD.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/tv5_hd/default1/index.mpd",
    clearKey: { kid: "2615129ef2c846a9bbd43a641c7303ef", key: "07c7f996b1734ea288641a68e1cfdc4d" },
  },
  "lotus-macau": {
    name: "Lotus Macau",
    logo: "https://i.imgur.com/5G72qjx.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/lotusmacau_prd/default/index.mpd",
    clearKey: { kid: "60dc692e64ea443a8fb5ac186c865a9b", key: "01bdbe22d59b2a4504b53adc2f606cc1" },
  },
  tvup: {
    name: "tvUP",
    logo: "https://i.imgur.com/OHLO5Hz.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/tvup_prd/default/index.mpd",
    clearKey: { kid: "83e813ccd4ca4837afd611037af02f63", key: "a97c515dbcb5dcbc432bbd09d15afd41" },
  },
  "thrill-sd": {
    name: "Thrill",
    logo: "https://i.imgur.com/kgqsalZ.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_thrill_sd/default/index.mpd",
    clearKey: { kid: "928114ffb2394d14b5585258f70ed183", key: "a82edc340bc73447bac16cdfed0a4c62" },
  },
  axn: {
    name: "AXN",
    logo: "https://i.imgur.com/OuaLV7f.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_axn_sd/default/index.mpd",
    clearKey: { kid: "fd5d928f5d974ca4983f6e9295dfe410", key: "3aaa001ddc142fedbb9d5557be43792f" },
  },
  "hits-hd": {
    name: "Hits HD",
    logo: "https://i.imgur.com/CxqHKUO.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/hits_hd1/default/index.mpd",
    clearKey: { kid: "dac605bc197e442c93f4f08595a95100", key: "975e27ffc1b7949721ee3ccb4b7fd3e5" },
  },
  "hits-now": {
    name: "Hits Now",
    logo: "https://i.imgur.com/Ck0ad9b.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_hitsnow/default/index.mpd",
    clearKey: { kid: "14439a1b7afc4527bb0ebc51cf11cbc1", key: "92b0287c7042f271b266cc11ab7541f1" },
  },
  ibc: {
    name: "IBC 13",
    logo: "https://i.imgur.com/CTHhr3Q.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/ibc13_sd_new/default1/index.mpd",
    clearKey: { kid: "16ecd238c0394592b8d3559c06b1faf5", key: "05b47ae3be1368912ebe28f87480fc84" },
  },
  "true-fm-tv": {
    name: "TrueTV",
    logo: "https://i.imgur.com/i0xetYa.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/truefm_tv/default/index.mpd",
    clearKey: { kid: "0559c95496d44fadb94105b9176c3579", key: "40d8bb2a46ffd03540e0c6210ece57ce" },
  },
  "tvn-premium-hd": {
    name: "TVN Premium",
    logo: "https://i.imgur.com/qEPJE1t.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_tvnpre/default/index.mpd",
    clearKey: { kid: "e1bde543e8a140b38d3f84ace746553e", key: "b712c4ec307300043333a6899a402c10" },
  },
  "kbs-world-sd": {
    name: "KBS World",
    logo: "https://i.imgur.com/aFDRmtm.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/kbsworld/default/index.mpd",
    clearKey: { kid: "22ff2347107e4871aa423bea9c2bd363", key: "c6e7ba2f48b3a3b8269e8bc360e60404" },
  },

  // Movies
  "tvn-movies-pinoy": {
    name: "TVN Movies Pinoy",
    logo: "https://i.imgur.com/8YhI91e.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_tvnmovie/default/index.mpd",
    clearKey: { kid: "2e53f8d8a5e94bca8f9a1e16ce67df33", key: "3471b2464b5c7b033a03bb8307d9fa35" },
  },
  pbo: {
    name: "PBO",
    logo: "https://i.imgur.com/r3PUF9p.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/pbo_sd/default/index.mpd",
    clearKey: { kid: "dcbdaaa6662d4188bdf97f9f0ca5e830", key: "31e752b441bd2972f2b98a4b1bc1c7a1" },
  },
  "viva-cinema": {
    name: "Viva Cinema",
    logo: "https://i.imgur.com/hBb2Fh9.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/viva_sd/default/index.mpd",
    clearKey: { kid: "07aa813bf2c147748046edd930f7736e", key: "3bd6688b8b44e96201e753224adfc8fb" },
  },
  hbo: {
    name: "HBO",
    logo: "https://i.imgur.com/6uN52OW.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_hbohd/default/index.mpd",
    clearKey: { kid: "d47ebabf7a21430b83a8c4b82d9ef6b1", key: "54c213b2b5f885f1e0290ee4131d425b" },
  },
  "hbo-hits": {
    name: "HBO Hits",
    logo: "https://i.imgur.com/tGSLZWz.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_hbohits/default1/index.mpd",
    clearKey: { kid: "b04ae8017b5b4601a5a0c9060f6d5b7d", key: "a8795f3bdb8a4778b7e888ee484cc7a1" },
  },
  "hbo-family": {
    name: "HBO Family",
    logo: "https://i.imgur.com/SefoKAw.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_hbofam/default/index.mpd",
    clearKey: { kid: "872910c843294319800d85f9a0940607", key: "f79fd895b79c590708cf5e8b5c6263be" },
  },
  "hbo-signature": {
    name: "HBO Signature",
    logo: "https://i.imgur.com/3L9QRDw.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_hbosign/default/index.mpd",
    clearKey: { kid: "a06ca6c275744151895762e0346380f5", key: "559da1b63eec77b5a942018f14d3f56f" },
  },
  cinemax: {
    name: "Cinemax",
    logo: "https://i.imgur.com/9LNJXe3.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_cinemax/default/index.mpd",
    clearKey: { kid: "b207c44332844523a3a3b0469e5652d7", key: "fe71aea346db08f8c6fbf0592209f955" },
  },

  // Sports
  "nba-tv": {
    name: "NBA TV Philippines",
    logo: "https://i.imgur.com/RcxNoIC.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cgnl_nba/default/index.mpd",
    clearKey: { kid: "c5e51f41ceac48709d0bdcd9c13a4d88", key: "20b91609967e472c27040716ef6a8b9a" },
  },
  "pba-rush": {
    name: "PBA Rush",
    logo: "https://i.imgur.com/Z7oMGiI.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_pbarush_hd1/default/index.mpd",
    clearKey: { kid: "76dc29dd87a244aeab9e8b7c5da1e5f3", key: "95b2f2ffd4e14073620506213b62ac82" },
  },
  "one-sports-hd": {
    name: "One Sports HD",
    logo: "https://i.imgur.com/imI97L2.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_onesports_hd/default/index.mpd",
    clearKey: { kid: "53c3bf2eba574f639aa21f2d4409ff11", key: "3de28411cf08a64ea935b9578f6d0edd" },
  },
  "one-sports-plus": {
    name: "One Sports Plus",
    logo: "https://i.imgur.com/RnDeKOj.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_onesportsplus_hd1/default/index.mpd",
    clearKey: { kid: "322d06e9326f4753a7ec0908030c13d8", key: "1e3e0ca32d421fbfec86feced0efefda" },
  },
  "premier-sports": {
    name: "Premier Sports",
    logo: "https://i.imgur.com/GTfUEnU.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_ps_hd1/default/index.mpd",
    clearKey: { kid: "b8b595299fdf41c1a3481fddeb0b55e4", key: "cd2b4ad0eb286239a4a022e6ca5fd007" },
  },
  "premier-sports-2": {
    name: "Premier Sports 2",
    logo: "https://i.imgur.com/OWVR172.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/premiersports2hd/default/index.mpd",
    clearKey: { kid: "59454adb530b4e0784eae62735f9d850", key: "61100d0b8c4dd13e4eb8b4851ba192cc" },
  },
  "spotv-hd": {
    name: "SpoTV HD",
    logo: "https://i.imgur.com/QExPfsT.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_spotvhd/default/index.mpd",
    clearKey: { kid: "ec7ee27d83764e4b845c48cca31c8eef", key: "9c0e4191203fccb0fde34ee29999129e" },
  },
  "spotv-2-hd": {
    name: "SpoTV 2 HD",
    logo: "https://i.imgur.com/7mY1Zxg.png",
    group: "Sports",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/dr_spotv2hd/default/index.mpd",
    clearKey: { kid: "7eea72d6075245a99ee3255603d58853", key: "6848ef60575579bf4d415db1032153ed" },
  },

  // Kids
  animax: {
    name: "Animax",
    logo: "https://i.imgur.com/5gJTEHT.png",
    group: "Kids",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_animax_sd_new/default/index.mpd",
    clearKey: { kid: "92032b0e41a543fb9830751273b8debd", key: "03f8b65e2af785b10d6634735dbe6c11" },
  },
  "dreamworks-hd": {
    name: "DreamWorks HD",
    logo: "https://i.imgur.com/bzTr9Y2.png",
    group: "Kids",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_dreamworks_hd1/default/index.mpd",
    clearKey: { kid: "4ab9645a2a0a47edbd65e8479c2b9669", key: "8cb209f1828431ce9b50b593d1f44079" },
  },
  "cartoon-network": {
    name: "Cartoon Network",
    logo: "https://poster.starhubgo.com/Linear_channels2/316_1920x1080_HTV.png",
    group: "Kids",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cartoonnetworkhd/default/index.mpd",
    clearKey: { kid: "a2d1f552ff9541558b3296b5a932136b", key: "cdd48fa884dc0c3a3f85aeebca13d444" },
  },
  nickelodeon: {
    name: "Nickelodeon",
    logo: "https://i.imgur.com/4o5dNZA.png",
    group: "Kids",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/dr_nickelodeon/default/index.mpd",
    clearKey: { kid: "9ce58f37576b416381b6514a809bfd8b", key: "f0fbb758cdeeaddfa3eae538856b4d72" },
  },
  "nick-jr": {
    name: "Nick Jr",
    logo: "https://i.imgur.com/iIVYdZP.png",
    group: "Kids",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/dr_nickjr/default/index.mpd",
    clearKey: { kid: "bab5c11178b646749fbae87962bf5113", key: "0ac679aad3b9d619ac39ad634ec76bc8" },
  },

  // News
  "ptv-4": {
    name: "PTV",
    logo: "https://i.imgur.com/jRvEV4E.png",
    group: "News",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_ptv4_sd/default/index.mpd",
    clearKey: { kid: "71a130a851b9484bb47141c8966fb4a3", key: "ad1f003b4f0b31b75ea4593844435600" },
  },
  rptv: {
    name: "RPTV",
    logo: "https://cms.cignal.tv/Upload/Thumbnails/rptv%20logo%20final-02.png",
    group: "News",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cnn_rptv_prod_hd/default/index.mpd",
    clearKey: { kid: "1917f4caf2364e6d9b1507326a85ead6", key: "a1340a251a5aa63a9b0ea5d9d7f67595" },
  },
  "cnn-international": {
    name: "CNN International",
    logo: "http://115.146.176.131:80/images/2acf9495fde07739914e7a7bb3ffee94.png",
    group: "News",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_cnnhd/default/index.mpd",
    clearKey: { kid: "900c43f0e02742dd854148b7a75abbec", key: "da315cca7f2902b4de23199718ed7e90" },
  },
  "bbc-news": {
    name: "BBC World News",
    logo: "https://i.imgur.com/CTf7nGs.png",
    group: "News",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/bbcworld_news_sd/default/index.mpd",
    clearKey: { kid: "f59650be475e4c34a844d4e2062f71f3", key: "119639e849ddee96c4cec2f2b6b09b40" },
  },
  bloomberg: {
    name: "Bloomberg",
    logo: "https://i.imgur.com/2WGEb3V.png",
    group: "News",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/bloomberg_sd/default/index.mpd",
    clearKey: { kid: "ef7d9dcfb99b406cb79fb9f675cba426", key: "b24094f6ca136af25600e44df5987af4" },
  },
  "one-news-hd": {
    name: "One News",
    logo: "https://i.imgur.com/25PG6TF.png",
    group: "News",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/onenews_hd1/default/index.mpd",
    clearKey: { kid: "d39eb201ae494a0b98583df4d110e8dd", key: "6797066880d344422abd3f5eda41f45f" },
  },

  // Lifestyle
  "lifetime-sd": {
    name: "Lifetime",
    logo: "https://i.imgur.com/ZyqbNXn.png",
    group: "Lifestyle",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/dr_lifetime/default/index.mpd",
    clearKey: { kid: "cf861d26e7834166807c324d57df5119", key: "64a81e30f6e5b7547e3516bbf8c647d0" },
  },
  "food-network-hd": {
    name: "Food Network",
    logo: "https://i.imgur.com/FZBze3z.png",
    group: "Lifestyle",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_foodnetwork_hd1/default/index.mpd",
    clearKey: { kid: "b7299ea0af8945479cd2f287ee7d530e", key: "b8ae7679cf18e7261303313b18ba7a14" },
  },
  "hgtv-hd": {
    name: "HGTV",
    logo: "https://i.imgur.com/a6gRxAV.png",
    group: "Lifestyle",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/hgtv_hd1/default/index.mpd",
    clearKey: { kid: "f0e3ab943318471abc8b47027f384f5a", key: "13802a79b19cc3485d2257165a7ef62a" },
  },

  // Documentary
  "history-hd": {
    name: "History HD",
    logo: "https://i.imgur.com/oJQJyhb.png",
    group: "Documentary",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/dr_historyhd/default/index.mpd",
    clearKey: { kid: "a7724b7ca2604c33bb2e963a0319968a", key: "6f97e3e2eb2bade626e0281ec01d3675" },
  },
  "discovery-channel": {
    name: "Discovery Channel",
    logo: "https://i.imgur.com/XsvAk5H.png",
    group: "Documentary",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/discovery/default/index.mpd",
    clearKey: { kid: "d9ac48f5131641a789328257e778ad3a", key: "b6e67c37239901980c6e37e0607ceee6" },
  },
  "animal-planet": {
    name: "Animal Planet",
    logo: "https://i.imgur.com/SkpFpW4.png",
    group: "Documentary",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_animal_planet_sd/default/index.mpd",
    clearKey: { kid: "436b69f987924fcbbc06d40a69c2799a", key: "c63d5b0d7e52335b61aeba4f6537d54d" },
  },
  "bbc-earth": {
    name: "BBC Earth",
    logo: "https://i.imgur.com/vip1JIz.png",
    group: "Documentary",
    mpdUrl: "https://qp-pldt-live-bpk-01-prod.akamaized.net/bpk-tv/cg_bbcearth_hd1/default/index.mpd",
    clearKey: { kid: "34ce95b60c424e169619816c5181aded", key: "0e2a2117d705613542618f58bf26fc8e" },
  },
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (path === "/" || path === "/channels") {
        const channelLinks = Object.entries(CHANNELS)
          .map(([id, channel]) => `${channel.name}: ${url.origin}/hls/${id}/playlist.m3u8`)
          .join("\n")

        const response = {
          message: "MPD to M3U8 Converter - Direct Streaming Links",
          channels: Object.keys(CHANNELS).map((id) => ({
            id,
            name: CHANNELS[id].name,
            logo: CHANNELS[id].logo,
            group: CHANNELS[id].group,
            hlsUrl: `${url.origin}/hls/${id}/playlist.m3u8`,
          })),
          directLinks: channelLinks,
          usage: {
            masterPlaylist: `${url.origin}/playlist.m3u8`,
            channelPlaylist: `${url.origin}/hls/{channelId}/playlist.m3u8`,
            examples: {
              "One PH": `${url.origin}/hls/one-ph/playlist.m3u8`,
              TV5: `${url.origin}/hls/tv5-hd/playlist.m3u8`,
              HBO: `${url.origin}/hls/hbo/playlist.m3u8`,
              "NBA TV": `${url.origin}/hls/nba-tv/playlist.m3u8`,
            },
          },
        }

        return new Response(JSON.stringify(response, null, 2), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Generate M3U8 playlist for all channels
      if (path === "/playlist.m3u8") {
        const m3u8Content = generateMasterPlaylist(url.origin)
        return new Response(m3u8Content, {
          headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
        })
      }

      // HLS endpoint for specific channel
      const hlsMatch = path.match(/^\/hls\/([^/]+)\/(.+)$/)
      if (hlsMatch) {
        const [, channelId, hlsPath] = hlsMatch
        const channel = CHANNELS[channelId]

        if (!channel) {
          return new Response("Channel not found", { status: 404, headers: corsHeaders })
        }

        return await handleHlsRequest(channel, hlsPath, url, corsHeaders)
      }

      // Proxy segment requests
      const segmentMatch = path.match(/^\/segment\/([^/]+)\/(.+)$/)
      if (segmentMatch) {
        const [, channelId, segmentPath] = segmentMatch
        const channel = CHANNELS[channelId]

        if (!channel) {
          return new Response("Channel not found", { status: 404, headers: corsHeaders })
        }

        return await handleSegmentRequest(channel, segmentPath, corsHeaders)
      }

      return new Response("Not found", { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error("Error:", error)
      return new Response("Internal server error", {
        status: 500,
        headers: corsHeaders,
      })
    }
  },
}

function generateMasterPlaylist(origin: string): string {
  let m3u8 = "#EXTM3U\n\n"

  // Group channels by category
  const groups: Record<string, Array<{ id: string; channel: ChannelInfo }>> = {}
  Object.entries(CHANNELS).forEach(([id, channel]) => {
    if (!groups[channel.group]) groups[channel.group] = []
    groups[channel.group].push({ id, channel })
  })

  Object.entries(groups).forEach(([groupName, channels]) => {
    m3u8 += `#EXTINF:-1 group-title="${groupName}",${groupName}\n\n`

    channels.forEach(({ id, channel }) => {
      m3u8 += `#EXTINF:-1 tvg-logo="${channel.logo}" group-title="${groupName}",${channel.name}\n`
      m3u8 += `${origin}/hls/${id}/playlist.m3u8\n\n`
    })
  })

  return m3u8
}

async function handleHlsRequest(
  channel: ChannelInfo,
  hlsPath: string,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (hlsPath === "playlist.m3u8") {
    const m3u8Content = await generateHlsPlaylist(channel, url.origin)
    return new Response(m3u8Content, {
      headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
    })
  }

  const variantMatch = hlsPath.match(/^variant_(\d+)\.m3u8$/)
  if (variantMatch) {
    const [, variantIndex] = variantMatch
    const variantPath = `variant_${variantIndex}.m3u8`
    const variantContent = await generateVariantPlaylist(channel, variantPath, url.origin)
    return new Response(variantContent, {
      headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
    })
  }

  return new Response("Not found", { status: 404, headers: corsHeaders })
}

async function generateHlsPlaylist(channel: ChannelInfo, origin: string): Promise<string> {
  try {
    // Fetch and parse MPD
    const mpdResponse = await fetch(channel.mpdUrl)
    const mpdText = await mpdResponse.text()
    const parser = new DOMParser()
    const mpdDoc = parser.parseFromString(mpdText, "text/xml")

    // Extract adaptation sets
    const adaptationSets = mpdDoc.getElementsByTagName("AdaptationSet")
    let m3u8 = "#EXTM3U\n#EXT-X-VERSION:6\n\n"

    const channelId = getChannelId(channel)
    let variantIndex = 0

    for (let i = 0; i < adaptationSets.length; i++) {
      const adaptationSet = adaptationSets[i]
      const mimeType = adaptationSet.getAttribute("mimeType") || ""

      if (mimeType.includes("video")) {
        const representations = adaptationSet.getElementsByTagName("Representation")

        for (let j = 0; j < representations.length; j++) {
          const representation = representations[j]
          const bandwidth = representation.getAttribute("bandwidth")
          const width = representation.getAttribute("width")
          const height = representation.getAttribute("height")
          const codecs = representation.getAttribute("codecs")

          if (bandwidth) {
            m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}`
            if (width && height) m3u8 += `,RESOLUTION=${width}x${height}`
            if (codecs) m3u8 += `,CODECS="${codecs}"`
            m3u8 += "\n"
            m3u8 += `${origin}/hls/${channelId}/variant_${variantIndex}.m3u8\n`
            variantIndex++
          }
        }
      }
    }

    // Fallback if no video streams found
    if (variantIndex === 0) {
      m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\n`
      m3u8 += `${origin}/hls/${channelId}/variant_0.m3u8\n`
    }

    return m3u8
  } catch (error) {
    console.error("Error generating HLS playlist:", error)
    // Fallback playlist
    const channelId = getChannelId(channel)
    return `#EXTM3U\n#EXT-X-VERSION:6\n\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\n${origin}/hls/${channelId}/variant_0.m3u8\n`
  }
}

async function generateVariantPlaylist(channel: ChannelInfo, variantPath: string, origin: string): Promise<string> {
  try {
    // Fetch and parse MPD to get segment information
    const mpdResponse = await fetch(channel.mpdUrl)
    const mpdText = await mpdResponse.text()
    const parser = new DOMParser()
    const mpdDoc = parser.parseFromString(mpdText, "text/xml")

    // Extract base URL from MPD
    const baseUrlElements = mpdDoc.getElementsByTagName("BaseURL")
    let baseUrl = channel.mpdUrl.replace("/index.mpd", "")
    if (baseUrlElements.length > 0) {
      const baseUrlText = baseUrlElements[0].textContent
      if (baseUrlText) {
        baseUrl = baseUrlText.startsWith("http") ? baseUrlText : `${baseUrl}/${baseUrlText}`
      }
    }

    // Find video adaptation set
    const adaptationSets = mpdDoc.getElementsByTagName("AdaptationSet")
    let videoAdaptationSet = null

    for (let i = 0; i < adaptationSets.length; i++) {
      const mimeType = adaptationSets[i].getAttribute("mimeType") || ""
      if (mimeType.includes("video")) {
        videoAdaptationSet = adaptationSets[i]
        break
      }
    }

    if (!videoAdaptationSet) {
      throw new Error("No video adaptation set found")
    }

    // Get segment template or list
    const segmentTemplates = videoAdaptationSet.getElementsByTagName("SegmentTemplate")
    const segmentLists = videoAdaptationSet.getElementsByTagName("SegmentList")

    let m3u8 = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

`

    const channelId = getChannelId(channel)

    if (segmentTemplates.length > 0) {
      // Handle segment template
      const template = segmentTemplates[0]
      const media = template.getAttribute("media") || ""
      const initialization = template.getAttribute("initialization") || ""
      const startNumber = Number.parseInt(template.getAttribute("startNumber") || "1")
      const duration = Number.parseFloat(template.getAttribute("duration") || "10")
      const timescale = Number.parseInt(template.getAttribute("timescale") || "1")

      const segmentDuration = duration / timescale

      // Add initialization segment if present
      if (initialization) {
        const initUrl = initialization.replace("$RepresentationID$", "video")
        m3u8 += `#EXT-X-MAP:URI="${origin}/segment/${channelId}/${initUrl}"\n`
      }

      // Generate segments for live stream (last 10 segments)
      const currentTime = Math.floor(Date.now() / 1000)
      const segmentCount = 10

      for (let i = 0; i < segmentCount; i++) {
        const segmentNumber = startNumber + i
        const segmentUrl = media
          .replace("$Number$", segmentNumber.toString())
          .replace("$RepresentationID$", "video")
          .replace("$Time$", (segmentNumber * duration).toString())

        m3u8 += `#EXTINF:${segmentDuration.toFixed(3)},\n`
        m3u8 += `${origin}/segment/${channelId}/${segmentUrl}\n`
      }
    } else if (segmentLists.length > 0) {
      // Handle segment list
      const segmentList = segmentLists[0]
      const segments = segmentList.getElementsByTagName("SegmentURL")

      for (let i = 0; i < segments.length && i < 10; i++) {
        const segment = segments[i]
        const media = segment.getAttribute("media") || ""

        m3u8 += `#EXTINF:10.0,\n`
        m3u8 += `${origin}/segment/${channelId}/${media}\n`
      }
    } else {
      throw new Error("No segment information found in MPD")
    }

    return m3u8
  } catch (error) {
    console.error("Error generating variant playlist:", error)
    throw error
  }
}

async function handleSegmentRequest(
  channel: ChannelInfo,
  segmentPath: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    console.log(`[v0] Handling segment request: ${segmentPath}`)

    // Construct the actual segment URL
    let segmentUrl: string

    if (segmentPath.startsWith("http")) {
      segmentUrl = segmentPath
    } else {
      const baseUrl = channel.mpdUrl.replace("/index.mpd", "")
      segmentUrl = `${baseUrl}/${segmentPath}`
    }

    console.log(`[v0] Fetching segment from: ${segmentUrl}`)

    // Fetch the segment
    const segmentResponse = await fetch(segmentUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: channel.mpdUrl,
      },
    })

    if (!segmentResponse.ok) {
      console.log(`[v0] Segment fetch failed: ${segmentResponse.status}`)
      return new Response("Segment not found", { status: 404, headers: corsHeaders })
    }

    const segmentData = await segmentResponse.arrayBuffer()
    console.log(`[v0] Segment data size: ${segmentData.byteLength}`)

    // Check if segment is encrypted (look for PSSH box or other encryption indicators)
    const isEncrypted = await checkIfEncrypted(segmentData)

    let finalData = segmentData

    if (isEncrypted) {
      console.log(`[v0] Decrypting segment with clearkey`)
      finalData = await decryptSegment(segmentData, channel.clearKey)
    }

    // Return the segment data
    return new Response(finalData, {
      headers: {
        ...corsHeaders,
        "Content-Type": segmentPath.endsWith(".mp4") ? "video/mp4" : "video/mp2t",
        "Cache-Control": "public, max-age=300",
        "Accept-Ranges": "bytes",
      },
    })
  } catch (error) {
    console.error(`[v0] Error handling segment request:`, error)
    return new Response("Segment error", { status: 500, headers: corsHeaders })
  }
}

async function decryptSegment(encryptedData: ArrayBuffer, clearKey: ClearKeyInfo): Promise<ArrayBuffer> {
  try {
    // Convert hex strings to ArrayBuffer
    const keyBuffer = hexToArrayBuffer(clearKey.key)

    // For ClearKey, we need to extract the IV from the segment or use a default
    // In most cases, the IV is derived from the segment or is all zeros for initialization
    const iv = new ArrayBuffer(16) // 16 bytes of zeros for AES-128

    // Import the key for AES-128-CTR decryption (ClearKey typically uses CTR mode)
    const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-CTR" }, false, ["decrypt"])

    // Decrypt the data using AES-CTR
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-CTR",
        counter: iv,
        length: 128,
      },
      cryptoKey,
      encryptedData,
    )

    console.log(`[v0] Decryption successful, size: ${decryptedData.byteLength}`)
    return decryptedData
  } catch (error) {
    console.error(`[v0] Decryption error:`, error)
    // Return original data if decryption fails
    return encryptedData
  }
}

async function checkIfEncrypted(data: ArrayBuffer): Promise<boolean> {
  // Simple check for common encryption indicators
  const view = new Uint8Array(data)

  // Look for PSSH box (Protection System Specific Header)
  for (let i = 0; i < view.length - 4; i++) {
    if (view[i] === 0x70 && view[i + 1] === 0x73 && view[i + 2] === 0x73 && view[i + 3] === 0x68) {
      return true
    }
  }

  // Look for encrypted sample entries
  for (let i = 0; i < view.length - 4; i++) {
    if (view[i] === 0x65 && view[i + 1] === 0x6e && view[i + 2] === 0x63 && view[i + 3] === 0x76) {
      return true
    }
  }

  return false
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }
  return bytes.buffer
}

function getChannelId(channel: ChannelInfo): string {
  return Object.keys(CHANNELS).find((key) => CHANNELS[key] === channel) || "unknown"
}

type Env = {}
