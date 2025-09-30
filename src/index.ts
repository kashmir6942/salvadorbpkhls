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
  "tv5-hd": {
    name: "TV5",
    logo: "https://i.imgur.com/U5L67WD.png",
    group: "Entertainment",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/tv5_hd/default1/index.mpd",
    clearKey: { kid: "2615129ef2c846a9bbd43a641c7303ef", key: "07c7f996b1734ea288641a68e1cfdc4d" },
  },
  hbo: {
    name: "HBO",
    logo: "https://i.imgur.com/6uN52OW.png",
    group: "Movies",
    mpdUrl: "https://qp-pldt-live-bpk-02-prod.akamaized.net/bpk-tv/cg_hbohd/default/index.mpd",
    clearKey: { kid: "d47ebabf7a21430b83a8c4b82d9ef6b1", key: "54c213b2b5f885f1e0290ee4131d425b" },
  },
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
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (path === "/" || path === "/channels") {
        return new Response(
          JSON.stringify({
            channels: Object.keys(CHANNELS).map((id) => ({
              id,
              name: CHANNELS[id].name,
              logo: CHANNELS[id].logo,
              group: CHANNELS[id].group,
              hlsUrl: `${url.origin}/proxy/mpd/manifest.m3u8?channel=${id}`,
            })),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      if (path === "/proxy/mpd/manifest.m3u8") {
        const channelId = url.searchParams.get("channel")
        if (!channelId || !CHANNELS[channelId]) {
          return new Response("Channel not found", { status: 404, headers: corsHeaders })
        }

        const channel = CHANNELS[channelId]
        const manifest = await generateMasterManifest(channel, url.origin, channelId)
        return new Response(manifest, {
          headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
        })
      }

      if (path === "/proxy/mpd/playlist.m3u8") {
        const channelId = url.searchParams.get("channel")
        const representationId = url.searchParams.get("representation_id")

        if (!channelId || !CHANNELS[channelId]) {
          return new Response("Channel not found", { status: 404, headers: corsHeaders })
        }

        const channel = CHANNELS[channelId]
        const playlist = await generateVariantPlaylist(channel, representationId || "0", url.origin, channelId)
        return new Response(playlist, {
          headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
        })
      }

      if (path === "/proxy/mpd/segment.m4s") {
        const channelId = url.searchParams.get("channel")
        const segmentUrl = url.searchParams.get("url")
        const isInit = url.searchParams.get("init") === "true"

        if (!channelId || !CHANNELS[channelId] || !segmentUrl) {
          return new Response("Invalid request", { status: 400, headers: corsHeaders })
        }

        const channel = CHANNELS[channelId]
        return await handleSegmentRequest(channel, segmentUrl, isInit, corsHeaders, request)
      }

      return new Response("Not found", { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error("[v0] Error:", error)
      return new Response(`Internal server error: ${error}`, {
        status: 500,
        headers: corsHeaders,
      })
    }
  },
}

async function generateMasterManifest(channel: ChannelInfo, origin: string, channelId: string): Promise<string> {
  try {
    console.log("[v0] Fetching MPD:", channel.mpdUrl)
    const mpdResponse = await fetch(channel.mpdUrl)
    const mpdText = await mpdResponse.text()
    console.log("[v0] MPD fetched, parsing...")

    const parser = new DOMParser()
    const mpdDoc = parser.parseFromString(mpdText, "text/xml")

    const adaptationSets = mpdDoc.getElementsByTagName("AdaptationSet")
    let m3u8 = "#EXTM3U\n#EXT-X-VERSION:6\n\n"

    console.log("[v0] Found", adaptationSets.length, "adaptation sets")

    for (let i = 0; i < adaptationSets.length; i++) {
      const adaptationSet = adaptationSets[i]
      const mimeType = adaptationSet.getAttribute("mimeType") || ""

      if (mimeType.includes("video")) {
        const representations = adaptationSet.getElementsByTagName("Representation")
        console.log("[v0] Found", representations.length, "video representations")

        for (let j = 0; j < representations.length; j++) {
          const representation = representations[j]
          const id = representation.getAttribute("id")
          const bandwidth = representation.getAttribute("bandwidth")
          const width = representation.getAttribute("width")
          const height = representation.getAttribute("height")
          const codecs = representation.getAttribute("codecs")

          if (bandwidth && width && height) {
            m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}`
            if (codecs) m3u8 += `,CODECS="${codecs}"`
            m3u8 += "\n"
            m3u8 += `${origin}/proxy/mpd/playlist.m3u8?channel=${channelId}&representation_id=${id || j}\n`
          }
        }
      }
    }

    console.log("[v0] Generated master manifest")
    return m3u8
  } catch (error) {
    console.error("[v0] Error generating master manifest:", error)
    throw error
  }
}

async function generateVariantPlaylist(
  channel: ChannelInfo,
  representationId: string,
  origin: string,
  channelId: string,
): Promise<string> {
  try {
    console.log("[v0] Generating variant playlist for representation:", representationId)
    const mpdResponse = await fetch(channel.mpdUrl)
    const mpdText = await mpdResponse.text()

    const parser = new DOMParser()
    const mpdDoc = parser.parseFromString(mpdText, "text/xml")

    // Get base URL
    const baseURLElements = mpdDoc.getElementsByTagName("BaseURL")
    let baseURL = channel.mpdUrl.substring(0, channel.mpdUrl.lastIndexOf("/") + 1)
    if (baseURLElements.length > 0 && baseURLElements[0].textContent) {
      baseURL = baseURLElements[0].textContent
      if (!baseURL.startsWith("http")) {
        baseURL = channel.mpdUrl.substring(0, channel.mpdUrl.lastIndexOf("/") + 1) + baseURL
      }
    }

    console.log("[v0] Base URL:", baseURL)

    // Find the representation
    const representations = mpdDoc.getElementsByTagName("Representation")
    let targetRepresentation = null

    for (let i = 0; i < representations.length; i++) {
      const rep = representations[i]
      const id = rep.getAttribute("id")
      if (id === representationId || i.toString() === representationId) {
        targetRepresentation = rep
        break
      }
    }

    if (!targetRepresentation && representations.length > 0) {
      targetRepresentation = representations[0]
    }

    if (!targetRepresentation) {
      throw new Error("No representation found")
    }

    console.log("[v0] Found target representation")

    // Get segment template
    let segmentTemplate = targetRepresentation.getElementsByTagName("SegmentTemplate")[0]
    if (!segmentTemplate) {
      const parent = targetRepresentation.parentNode
      if (parent) {
        const parentTemplates = (parent as Element).getElementsByTagName("SegmentTemplate")
        if (parentTemplates.length > 0) {
          segmentTemplate = parentTemplates[0]
        }
      }
    }

    if (!segmentTemplate) {
      throw new Error("No SegmentTemplate found")
    }

    const initialization = segmentTemplate.getAttribute("initialization") || ""
    const media = segmentTemplate.getAttribute("media") || ""
    const timescale = Number.parseInt(segmentTemplate.getAttribute("timescale") || "1")
    const startNumber = Number.parseInt(segmentTemplate.getAttribute("startNumber") || "1")

    console.log("[v0] SegmentTemplate - init:", initialization, "media:", media, "timescale:", timescale)

    // Get segment timeline
    const segmentTimeline = segmentTemplate.getElementsByTagName("SegmentTimeline")[0]
    const segments: Array<{ number: number; duration: number }> = []

    if (segmentTimeline) {
      const sElements = segmentTimeline.getElementsByTagName("S")
      let currentNumber = startNumber

      for (let i = 0; i < sElements.length; i++) {
        const s = sElements[i]
        const d = Number.parseInt(s.getAttribute("d") || "0")
        const r = Number.parseInt(s.getAttribute("r") || "0")

        // Add the segment
        segments.push({ number: currentNumber, duration: d / timescale })
        currentNumber++

        // Add repeated segments
        for (let j = 0; j < r; j++) {
          segments.push({ number: currentNumber, duration: d / timescale })
          currentNumber++
        }
      }
    } else {
      // Fallback: generate segments with default duration
      const duration = Number.parseInt(segmentTemplate.getAttribute("duration") || "60000")
      for (let i = 0; i < 100; i++) {
        segments.push({ number: startNumber + i, duration: duration / timescale })
      }
    }

    console.log("[v0] Generated", segments.length, "segments")

    // Build HLS playlist
    const targetDuration = Math.ceil(Math.max(...segments.map((s) => s.duration)))
    let m3u8 = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:${targetDuration}
#EXT-X-MEDIA-SEQUENCE:${startNumber}
#EXT-X-PLAYLIST-TYPE:EVENT

`

    // Add initialization segment as EXT-X-MAP
    if (initialization) {
      const repId = targetRepresentation.getAttribute("id") || "0"
      const initUrl = initialization.replace("$RepresentationID$", repId)
      const fullInitUrl = baseURL + initUrl
      const encodedInitUrl = encodeURIComponent(fullInitUrl)
      m3u8 += `#EXT-X-MAP:URI="${origin}/proxy/mpd/segment.m4s?channel=${channelId}&url=${encodedInitUrl}&init=true"\n`
    }

    // Add media segments
    for (const segment of segments.slice(0, 50)) {
      // Limit to first 50 segments for testing
      const repId = targetRepresentation.getAttribute("id") || "0"
      const segmentUrl = media.replace("$RepresentationID$", repId).replace("$Number$", segment.number.toString())
      const fullSegmentUrl = baseURL + segmentUrl
      const encodedSegmentUrl = encodeURIComponent(fullSegmentUrl)

      m3u8 += `#EXTINF:${segment.duration.toFixed(3)},\n`
      m3u8 += `${origin}/proxy/mpd/segment.m4s?channel=${channelId}&url=${encodedSegmentUrl}\n`
    }

    console.log("[v0] Generated variant playlist")
    return m3u8
  } catch (error) {
    console.error("[v0] Error generating variant playlist:", error)
    throw error
  }
}

async function handleSegmentRequest(
  channel: ChannelInfo,
  segmentUrl: string,
  isInit: boolean,
  corsHeaders: Record<string, string>,
  request: Request,
): Promise<Response> {
  try {
    console.log("[v0] Fetching segment:", segmentUrl, "isInit:", isInit)

    // Fetch the segment
    const headers: Record<string, string> = {}
    const rangeHeader = request.headers.get("Range")
    if (rangeHeader) {
      headers["Range"] = rangeHeader
    }

    const segmentResponse = await fetch(segmentUrl, { headers })

    if (!segmentResponse.ok) {
      console.error("[v0] Segment fetch failed:", segmentResponse.status)
      return new Response("Segment not found", { status: 404, headers: corsHeaders })
    }

    const segmentData = await segmentResponse.arrayBuffer()
    console.log("[v0] Segment fetched, size:", segmentData.byteLength)

    // Initialization segments are not encrypted
    if (isInit) {
      console.log("[v0] Returning init segment")
      return new Response(segmentData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "video/mp4",
          "Cache-Control": "public, max-age=31536000",
        },
      })
    }

    // Decrypt media segments using ClearKey (AES-CTR)
    console.log("[v0] Decrypting segment with ClearKey")
    const decryptedData = await decryptSegmentCTR(segmentData, channel.clearKey)
    console.log("[v0] Segment decrypted, size:", decryptedData.byteLength)

    return new Response(decryptedData, {
      headers: {
        ...corsHeaders,
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("[v0] Error handling segment:", error)
    return new Response(`Segment error: ${error}`, { status: 500, headers: corsHeaders })
  }
}

async function decryptSegmentCTR(encryptedData: ArrayBuffer, clearKey: ClearKeyInfo): Promise<ArrayBuffer> {
  try {
    // Convert hex key to ArrayBuffer
    const keyBuffer = hexToArrayBuffer(clearKey.key)

    // Import the key for AES-CTR decryption
    const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-CTR" }, false, ["decrypt"])

    // For MPEG-DASH, the IV is typically derived from the KID
    // Use the first 16 bytes of KID as IV (or zero-padded)
    const ivBuffer = hexToArrayBuffer(clearKey.kid)

    // Decrypt using AES-CTR
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-CTR",
        counter: ivBuffer,
        length: 128,
      },
      cryptoKey,
      encryptedData,
    )

    return decryptedData
  } catch (error) {
    console.error("[v0] Decryption error:", error)
    // Return original data if decryption fails
    return encryptedData
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }
  return bytes.buffer
}

type Env = {}
