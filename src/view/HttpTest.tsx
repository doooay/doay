import React, { useState, useEffect, useRef } from 'react'
import { Button, Box, Chip, Card, Paper, Stack, TextField, LinearProgress, Typography, MenuItem } from '@mui/material'

import { HtmlCodeViewer, JsonCodeViewer } from "../component/CodeViewer.tsx"
import { AutoCompleteField } from "../component/AutoCompleteField.tsx"
import { fetchResponseHeaders, fetchTextContent, getDoayAppDir, readAppConfig, readRayCommonConfig, readServerList, stopSpeedTestServer } from "../util/invoke.ts"
import { DEFAULT_APP_CONFIG, DEFAULT_RAY_COMMON_CONFIG } from "../util/config.ts"
import { useDebounce } from "../hook/useDebounce.ts"
import { formatSecond, sizeToUnit, sleep } from "../util/util.ts"
import { generateAndStartSpeedTestServer, generateServerPort } from "../util/serverSpeed.ts"

const urlList = [
    'https://www.google.com',
    'https://www.youtube.com',
    'https://www.facebook.com',
    'https://www.instagram.com',
    'https://myip.ipip.net',
    'https://www.x.com',
    'https://www.chatgpt.com',
    'https://www.whatsapp.com',
    'https://www.wikipedia.org',
    'https://www.reddit.com',
    'https://www.yahoo.co.jp',
    'https://www.yahoo.com',
    'https://www.yandex.ru',
    'https://www.amazon.com',
    'https://www.tiktok.com',
    'https://www.baidu.com',
    'https://www.linkedin.com',
    'https://www.netflix.com',
    'https://www.pornhub.com',
    'https://www.naver.com',
    'https://www.live.com',
    'https://www.office.com',
    'https://dzen.ru',
    'https://www.bing.com',
    'https://www.pinterest.com',
    'https://www.temu.com',
    'https://www.bilibili.com',
    'https://www.microsoft.com',
    'https://www.xvideos.com',
    'https://www.twitch.tv',
    'https://www.xhamster.com',
    'https://www.vk.com',
    'https://www.mail.ru',
    'https://www.sharepoint.com',
    'https://www.discord.com',
    'https://www.roblox.com',
    'https://www.zoom.us',
    'https://www.qq.com',
    'https://www.msn.com',
    'https://www.cloudflare.com',
    'https://www.chess.com',
    'https://www.espn.com',
    'https://www.cnn.com',
    'https://www.nytimes.com',
    'https://www.medium.com',
    'https://www.apple.com',
    'https://www.paypal.com',
    'https://www.ebay.com',
    'https://www.aliexpress.com',
    'https://www.canva.com',
    'https://www.taobao.com',
]

export const HttpTest = () => {
    const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG)

    const [serverList, setServerList] = useState<ServerList>([])
    const [speedTestServer, setSpeedTestServer] = useState(-1)

    const [urlValue, setUrlValue] = useState(urlList[0] || '')
    const [headersValue, setHeadersValue] = useState<any>()
    const [htmlValue, setHtmlValue] = useState('')

    const [requestType, setRequestType] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const [loading, setLoading] = useState(false)
    const [isInit, setIsInit] = useState(false)
    const loadConfig = useDebounce(async () => {
        const newConfig = await readAppConfig()
        if (newConfig) setAppConfig({...DEFAULT_APP_CONFIG, ...newConfig})

        const serverList = await readServerList() as ServerList
        if (serverList) setServerList(serverList)

        setIsInit(true)
    }, 100)
    useEffect(loadConfig, [])

    const handleServerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const key = Number(e.target.value)
        setSpeedTestServer(key)
        resetValue()
    }

    const urlValueChange = (value: string) => {
        setUrlValue(value)
        resetValue()
    }

    const resetValue = () => {
        setHeadersValue('')
        setHtmlValue('')
        setRequestType('')
        setErrorMsg('')
        setStatusCode(0)
        setElapsed(0)
    }

    const getProxyUrl = () => {
        return appConfig.ray_enable ? `socks5://${appConfig.ray_host}:${appConfig.ray_socks_port}` : ''
    }

    // ============== Test Server ==============
    const proxyUrl = useRef('')
    let testPort = useRef(0)
    let appDir = useRef<string>('')
    let rayCommonConfig = useRef<RayCommonConfig | null>(null)
    const startTestServer = async () => {
        if (speedTestServer === -1) {
            proxyUrl.current = getProxyUrl()
            return
        }

        if (!rayCommonConfig.current) rayCommonConfig.current = await readRayCommonConfig() || DEFAULT_RAY_COMMON_CONFIG
        if (!appDir.current) appDir.current = await getDoayAppDir()

        const server = serverList[speedTestServer]
        if (!server) return

        const port = await generateServerPort()
        if (!port) return

        const ok = await generateAndStartSpeedTestServer(server, appDir.current, rayCommonConfig.current, port)
        if (!ok) return

        testPort.current = port
        proxyUrl.current = `socks5://127.0.0.1:${port}`
        await sleep(500)
    }

    let timeoutStop = useRef<number>(0)
    const stopTestServer = () => {
        timeoutStop.current = setTimeout(async () => {
            await stopSpeedTestServer(testPort.current)
        }, 1000)
    }

    // ============== Get Headers ==============
    const [elapsed, setElapsed] = useState(0)
    const handleGetHeaders = async () => {
        if (!urlValue) return
        resetValue()
        setLoading(true)
        setRequestType('headers')

        await startTestServer()

        const startTime = performance.now()
        const result = await fetchResponseHeaders(urlValue, proxyUrl.current)
        const elapsed = Math.floor(performance.now() - startTime)
        setElapsed(elapsed)

        setStatusCode(result?.status || 0)
        if (result?.ok) {
            setHeadersValue(result.headers || {})
        } else {
            setErrorMsg(result?.error_message || '请求失败')
        }
        setLoading(false)
        stopTestServer()
    }

    // ============== Get Html ==============
    const handleGetHtml = async () => {
        if (!urlValue) return
        resetValue()
        setLoading(true)
        setRequestType('html')

        await startTestServer()

        const startTime = performance.now()
        const result = await fetchTextContent(urlValue, proxyUrl.current)
        const elapsed = Math.floor(performance.now() - startTime)
        setElapsed(elapsed)

        setStatusCode(result?.status || 0)
        if (result?.ok) {
            setHtmlValue(result.body || '')
        } else {
            setErrorMsg(result?.error_message || '请求失败')
        }
        setLoading(false)
        stopTestServer()
    }

    const [statusCode, setStatusCode] = useState(0)
    const getColor = () => {
        if (statusCode >= 200 && statusCode < 300) return "success"
        if (statusCode >= 300 && statusCode < 400) return "info"
        if (statusCode >= 400 && statusCode < 500) return "warning"
        return "error"
    }

    const getStatusMessage = () => {
        if (statusCode >= 200 && statusCode < 300) return "请求成功"
        if (statusCode >= 300 && statusCode < 400) return "重定向"
        if (statusCode >= 400 && statusCode < 500) return "客户端错误"
        if (statusCode >= 500) return "服务器错误"
        return "未知状态码"
    }

    return (<>
        <Stack spacing={2} sx={{pt: 1}}>
            <AutoCompleteField label="请求链接" id="test-url" value={urlValue} options={urlList} onChange={(value) => urlValueChange(value)}/>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Button disabled={loading} variant="contained" onClick={handleGetHeaders}>查看头信息</Button>
                    <Button disabled={loading} variant="contained" onClick={handleGetHtml}>查看源代码</Button>
                </Stack>

                {isInit && (appConfig.ray_enable ? <Chip label="代理已开启" color="success" variant="outlined"/> : <Chip label="代理未开启" color="error" variant="outlined"/>)}
            </Stack>

            <Card elevation={4} sx={{p: 1, pt: 2}}>
                <TextField
                    disabled={loading}
                    select fullWidth size="small"
                    label="测试服务器"
                    value={speedTestServer}
                    onChange={handleServerChange}
                >
                    <MenuItem value={-1}>跟随软件设置</MenuItem>
                    {serverList.map((item, key) => (
                        <MenuItem key={key} value={key}>{`${item.ps} | ${item.host}`}</MenuItem>
                    ))}
                </TextField>
            </Card>

            {loading ? (
                <Box sx={{py: 2}}><LinearProgress/></Box>
            ) : errorMsg ? (<>
                {statusCode > 0 && (
                    <Card elevation={4} sx={{p: 2}}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body1">返回状态码</Typography>
                            <Chip size="small" label={`HTTP ${statusCode} ｜ ${getStatusMessage()}`} color={getColor()}/>
                        </Stack>
                    </Card>
                )}

                <Card elevation={4} sx={{p: 1, pt: 2}}>
                    <TextField className="scr-w2" fullWidth multiline error minRows={2} maxRows={20} size="small" label="错误信息" value={errorMsg}/>
                </Card>
            </>) : statusCode > 0 && (<>
                <Card elevation={4} sx={{p: 1, px: 1.5}}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body1">返回状态码</Typography>
                        <Chip variant="outlined" size="small" label={`HTTP ${statusCode} ｜ ${getStatusMessage()}`} color={getColor()}/>
                    </Stack>
                </Card>

                {requestType === 'headers' ? (<>
                    <Card elevation={4}>
                        <Paper elevation={2} sx={{p: 1, px: 1.5, mb: '1px', borderRadius: '8px 8px 0 0'}}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body1">请求回应头信息</Typography>
                                <Stack direction="row" justifyContent="end" alignItems="center" spacing={1}>
                                    <Chip variant="outlined" size="small" label={`参数: ${Object.keys(headersValue).length} 条`} color="info"/>
                                    <Chip variant="outlined" size="small" label={`耗时: ${formatSecond(elapsed)}`} color="info"/>
                                </Stack>
                            </Stack>
                        </Paper>
                        <JsonCodeViewer value={headersValue} height="calc(100vh - 418px)"/>
                    </Card>
                </>) : requestType === 'html' && (<>
                    <Card elevation={4}>
                        <Paper elevation={2} sx={{p: 1, px: 1.5, mb: '1px', borderRadius: '8px 8px 0 0'}}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body1">HTML 源代码</Typography>
                                <Stack direction="row" justifyContent="end" alignItems="center" spacing={1}>
                                    <Chip variant="outlined" size="small" label={`大小: ${sizeToUnit(htmlValue.length)}`} color="info"/>
                                    <Chip variant="outlined" size="small" label={`耗时: ${formatSecond(elapsed)}`} color="info"/>
                                </Stack>
                            </Stack>
                        </Paper>
                        <HtmlCodeViewer value={htmlValue} height="calc(100vh - 418px)"/>
                    </Card>
                </>)}
            </>)}
        </Stack>
    </>)
}

export default HttpTest
