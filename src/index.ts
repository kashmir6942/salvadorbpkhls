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
      // Root endpoint - return channel list
      if (path === "/" || path === "/channels") {
        return new Response(
          JSON.stringify({
            channels: Object.keys(CHANNELS).map((id) => ({
              id,
              name: CHANNELS[id].name,
              logo: CHANNELS[id].logo,
              group: CHANNELS[id].group,
              // MediaFlow-style endpoint
              hlsUrl: `${url.origin}/proxy/mpd/manifest.m3u8?channel=${id}`,
            })),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      // Generate M3U8 playlist for all channels
      if (path === "/playlist.m3u8") {
        const m3u8Content = generateMasterPlaylist(url.origin)
        return new Response(m3u8Content, {
          headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
        })
      }

      if (path === "/proxy/mpd/manifest.m3u8") {
        const channelId = url.searchParams.get("channel")
        if (!channelId || !CHANNELS[channelId]) {
          return new Response("Channel not found", { status: 404, headers: corsHeaders })
        }
        return await handleMpdManifest(CHANNELS[channelId], url.origin, corsHeaders)
      }

      if (path === "/proxy/mpd/playlist.m3u8") {
        const channelId = url.searchParams.get("channel")
        const representationId = url.searchParams.get("representation")
        if (!channelId || !CHANNELS[channelId]) {
          return new Response("Channel not found", { status: 404, headers: corsHeaders })
        }
        return await handleMpdPlaylist(CHANNELS[channelId], representationId || "0", url.origin, corsHeaders)
      }

      if (path === "/proxy/mpd/segment.mp4") {
        const channelId = url.searchParams.get("channel")
        const segmentUrl = url.searchParams.get("url")
        if (!channelId || !CHANNELS[channelId] || !segmentUrl) {
          return new Response("Invalid segment request", { status: 400, headers: corsHeaders })
        }
        return await handleMpdSegment(CHANNELS[channelId], segmentUrl, request, corsHeaders)
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

function generateMasterPlaylist(origin: string): string {
  let m3u8 = "#EXTM3U\n\n"

  const groups: Record<string, Array<{ id: string; channel: ChannelInfo }>> = {}
  Object.entries(CHANNELS).forEach(([id, channel]) => {
    if (!groups[channel.group]) groups[channel.group] = []
    groups[channel.group].push({ id, channel })
  })

  Object.entries(groups).forEach(([groupName, items]) => {
    items.forEach(({ id, channel }) => {
      m3u8 += `#EXTINF:-1 tvg-logo="${channel.logo}" group-title="${groupName}",${channel.name}\n`
      m3u8 += `${origin}/proxy/mpd/manifest.m3u8?channel=${id}\n\n`
    })
  })

  return m3u8
}

async function handleMpdManifest(
  channel: ChannelInfo,
  origin: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    console.log("[v0] Fetching MPD:", channel.mpdUrl)
    const mpdResponse = await fetch(channel.mpdUrl)
    if (!mpdResponse.ok) {
      throw new Error(`MPD fetch failed: ${mpdResponse.status}`)
    }

    const mpdText = await mpdResponse.text()
    const parser = new DOMParser()
    const mpdDoc = parser.parseFromString(mpdText, "text/xml")

    // Parse adaptation sets for video
    const adaptationSets = mpdDoc.getElementsByTagName("AdaptationSet")
    let m3u8 = "#EXTM3U\n#EXT-X-VERSION:6\n\n"

    let representationIndex = 0
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
          const id = representation.getAttribute("id")

          if (bandwidth && width && height) {
            m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}`
            if (codecs) m3u8 += `,CODECS="${codecs}"`
            m3u8 += "\n"

            const channelId = getChannelId(channel)
            m3u8 += `${origin}/proxy/mpd/playlist.m3u8?channel=${channelId}&representation=${id || representationIndex}\n`
            representationIndex++
          }
        }
      }
    }

    console.log("[v0] Generated master manifest with", representationIndex, "variants")
    return new Response(m3u8, {
      headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
    })
  } catch (error) {
    console.error("[v0] Error generating manifest:", error)
    return new Response(`Manifest error: ${error}`, { status: 500, headers: corsHeaders })
  }
}

async function handleMpdPlaylist(
  channel: ChannelInfo,
  representationId: string,
  origin: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    console.log("[v0] Generating playlist for representation:", representationId)
    const mpdResponse = await fetch(channel.mpdUrl)
    const mpdText = await mpdResponse.text()
    const parser = new DOMParser()
    const mpdDoc = parser.parseFromString(mpdText, "text/xml")

    // Find the specific representation
    const representations = mpdDoc.getElementsByTagName("Representation")
    let targetRepresentation = null
    let representationIndex = 0

    for (let i = 0; i < representations.length; i++) {
      const rep = representations[i]
      const id = rep.getAttribute("id")
      if (id === representationId || representationIndex.toString() === representationId) {
        targetRepresentation = rep
        break
      }
      representationIndex++
    }

    if (!targetRepresentation) {
      targetRepresentation = representations[0] // Fallback to first
    }

    // Parse segment template
    const segmentTemplate =
      targetRepresentation.getElementsByTagName("SegmentTemplate")[0] ||
      targetRepresentation.parentNode?.getElementsByTagName("SegmentTemplate")[0]

    if (!segmentTemplate) {
      throw new Error("No SegmentTemplate found")
    }

    const media = segmentTemplate.getAttribute("media") || ""
    const initialization = segmentTemplate.getAttribute("initialization") || ""
    const timescale = Number.parseInt(segmentTemplate.getAttribute("timescale") || "1")
    const duration = Number.parseInt(segmentTemplate.getAttribute("duration") || "0")

    // Get segment timeline
    const segmentTimeline = segmentTemplate.getElementsByTagName("SegmentTimeline")[0]
    const baseUrl = channel.mpdUrl.replace("/index.mpd", "")
    const channelId = getChannelId(channel)

    let m3u8 = "#EXTM3U\n"
    m3u8 += "#EXT-X-VERSION:6\n"
    m3u8 += `#EXT-X-TARGETDURATION:${Math.ceil(duration / timescale)}\n`
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:0\n"

    // Add initialization segment (map)
    if (initialization) {
      const initUrl = initialization.replace("$RepresentationID$", representationId)
      const fullInitUrl = `${baseUrl}/${initUrl}`
      m3u8 += `#EXT-X-MAP:URI="${origin}/proxy/mpd/segment.mp4?channel=${channelId}&url=${encodeURIComponent(fullInitUrl)}"\n`
    }

    // Generate segments
    if (segmentTimeline) {
      const segments = segmentTimeline.getElementsByTagName("S")
      let segmentNumber = 1

      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]
        const t = s.getAttribute("t")
        const d = Number.parseInt(s.getAttribute("d") || "0")
        const r = Number.parseInt(s.getAttribute("r") || "0")

        // Repeat segments
        for (let j = 0; j <= r; j++) {
          const segmentDuration = d / timescale
          const segmentUrl = media
            .replace("$RepresentationID$", representationId)
            .replace("$Number$", segmentNumber.toString())
          const fullSegmentUrl = `${baseUrl}/${segmentUrl}`

          m3u8 += `#EXTINF:${segmentDuration.toFixed(3)},\n`
          m3u8 += `${origin}/proxy/mpd/segment.mp4?channel=${channelId}&url=${encodeURIComponent(fullSegmentUrl)}\n`
          segmentNumber++
        }
      }
    } else {
      // Fallback: generate segments based on duration
      const startNumber = Number.parseInt(segmentTemplate.getAttribute("startNumber") || "1")
      const segmentDuration = duration / timescale

      // Generate 100 segments for live stream
      for (let i = 0; i < 100; i++) {
        const segmentNumber = startNumber + i
        const segmentUrl = media
          .replace("$RepresentationID$", representationId)
          .replace("$Number$", segmentNumber.toString())
        const fullSegmentUrl = `${baseUrl}/${segmentUrl}`

        m3u8 += `#EXTINF:${segmentDuration.toFixed(3)},\n`
        m3u8 += `${origin}/proxy/mpd/segment.mp4?channel=${channelId}&url=${encodeURIComponent(fullSegmentUrl)}\n`
      }
    }

    console.log("[v0] Generated media playlist")
    return new Response(m3u8, {
      headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
    })
  } catch (error) {
    console.error("[v0] Error generating playlist:", error)
    return new Response(`Playlist error: ${error}`, { status: 500, headers: corsHeaders })
  }
}

async function handleMpdSegment(
  channel: ChannelInfo,
  segmentUrl: string,
  request: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    console.log("[v0] Fetching segment:", segmentUrl)

    // Forward range headers for byte-range requests
    const headers: Record<string, string> = {}
    const rangeHeader = request.headers.get("Range")
    if (rangeHeader) {
      headers["Range"] = rangeHeader
    }

    const segmentResponse = await fetch(segmentUrl, { headers })

    if (!segmentResponse.ok) {
      throw new Error(`Segment fetch failed: ${segmentResponse.status}`)
    }

    const encryptedData = await segmentResponse.arrayBuffer()
    console.log("[v0] Segment size:", encryptedData.byteLength)

    // Decrypt using ClearKey
    const decryptedData = await decryptClearKey(encryptedData, channel.clearKey)

    // Return decrypted MP4 segment (HLS players can handle fMP4)
    return new Response(decryptedData, {
      status: segmentResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "video/mp4",
        "Content-Length": decryptedData.byteLength.toString(),
        "Cache-Control": "public, max-age=31536000",
        "Accept-Ranges": "bytes",
      },
    })
  } catch (error) {
    console.error("[v0] Segment error:", error)
    return new Response(`Segment error: ${error}`, { status: 500, headers: corsHeaders })
  }
}

async function decryptClearKey(encryptedData: ArrayBuffer, clearKey: ClearKeyInfo): Promise<ArrayBuffer> {
  try {
    // ClearKey uses AES-128-CTR mode, not CBC
    const keyBuffer = hexToArrayBuffer(clearKey.key)
    const ivBuffer = hexToArrayBuffer(clearKey.kid)

    console.log("[v0] Decrypting with key:", clearKey.key.substring(0, 8) + "...")

    // Import key for AES-CTR
    const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-CTR" }, false, ["decrypt"])

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

    console.log("[v0] Decrypted size:", decryptedData.byteLength)
    return decryptedData
  } catch (error) {
    console.error("[v0] Decryption error:", error)
    // Return original data if decryption fails (might be unencrypted segment)
    return encryptedData
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

function getChannelId(channel: ChannelInfo): string {
  return Object.keys(CHANNELS).find((key) => CHANNELS[key] === channel) || "unknown"
}

type Env = {}
