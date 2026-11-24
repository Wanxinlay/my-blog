---
title: "自由上网指南：GL-MT3000 + OpenWrt + OpenClash 实战记录"
description: "基于 GL-MT3000 路由器的完整实战记录：刷机、网络配置、OpenClash 部署、DNS 去广告、稳定性调优、按需分流、WiFi 优化、远程访问与安全加固，附排障速查与踩坑清单。"
pubDatetime: 2026-11-25T10:00:00+08:00
tags:
  - 路由器
  - OpenWrt
  - 网络
draft: false
---

> 基于 GL-MT3000 + OpenWrt 25.12 + OpenClash 的实战记录整理。
> 所有命令均可直接复制执行，涉及具体凭据的地方用 `<...>` 标注，请替换为你自己的实际值。

---

## 一、准备与刷机

### 1.1 选固件

- 型号必须是 **GL.iNet GL-MT3000（MT7981）**
- 目标：`mediatek/filogic`，profile `glinet_gl-mt3000`
- 建议用**最新稳定版**（本文基于 25.12.x，包管理器是 **apk**，不是 opkg）

### 1.2 刷机前备份

```sh
# 原厂固件上执行，打包 /etc 全部配置
tar czf /tmp/gl-backup.tar.gz /etc
```

### 1.3 刷入

```sh
# 上传固件后校验
sha256sum openwrt-*-sysupgrade.bin
# 与官方 sha256sums 对比，一致再刷
sysupgrade -n /tmp/openwrt-*-sysupgrade.bin
```

> `-n` 表示不保留旧配置（跨版本刷机更稳）。

### 1.4 首启没有 Wi-Fi？

新固件出于安全默认**关闭 Wi-Fi**。不要慌，插网线：

```
电脑 → 路由器 LAN 口 → 浏览器 192.168.1.1
```

进去设置密码、开 Wi-Fi 即可。

---

## 二、基础网络配置

### 2.1 改 LAN 网段

```sh
uci set network.lan.ipaddr='192.168.8.1'
uci commit network
/etc/init.d/network restart
```

### 2.2 设置 Wi-Fi

```sh
uci set wireless.radio0.disabled='0'
uci set wireless.radio0.channel='6'
uci set wireless.radio0.htmode='HE20'

uci set wireless.default_radio0.ssid='我的WiFi'
uci set wireless.default_radio0.encryption='psk2'
uci set wireless.default_radio0.key='<WiFi密码>'
uci commit wireless
wifi reload
```

### 2.3 Wi-Fi 中继（STA）

```sh
# 在 radio1（5G）上建 STA 接口
uci set wireless.sta=wifi-iface
uci set wireless.sta.device='radio1'
uci set wireless.sta.mode='sta'
uci set wireless.sta.ssid='<上游SSID>'
uci set wireless.sta.key='<上游密码>'
uci set wireless.sta.encryption='psk2'
uci set wireless.sta.network='wwan'
uci commit wireless
wifi reload
```

### 2.4 双上行（有线优先）

```sh
uci set network.wan.metric='10'    # 有线优先
uci set network.wwan.metric='20'   # 中继备用
uci commit network
```

### 2.5 关键坑：wwan 要加入 wan 防火墙区

中继能连上但局域网没网，八成是这个：

```sh
uci add_list firewall.@zone[1].network='wwan'
uci commit firewall
/etc/init.d/firewall restart
```

---

## 三、OpenClash 部署

### 3.1 装依赖（apk 源用国内镜像）

```sh
# 先换源到 SJTU（清华镜像缺 luci 子目录）
sed -i 's|downloads.openwrt.org|mirror.sjtu.edu.cn|g' /etc/apk/repositories.d/distfeeds.list
apk update
apk add bash ruby ruby-yaml dnsmasq-full kmod-tun kmod-nft-tproxy curl
```

### 3.2 装 OpenClash

从 Release 下载 apk，装好后：

```sh
apk add --allow-untrusted /tmp/luci-app-openclash-*.apk
```

### 3.3 导入订阅

LuCI → 服务 → OpenClash → 配置文件 → 订阅，粘贴机场链接。

### 3.4 三个必踩的坑

**坑 1：不要用 sed 改 YAML**

行内数组和块格式混用会直接破坏解析：

```
did not find expected '-' indicator while parsing a block collection
```

正确做法：用 PyYAML 解析 → 修改 → 再解析校验 → 上传。

**坑 2：`default-nameserver: [system, ...]` 导致 DNS 回环**

mihomo 通过 `/etc/resolv.conf`（127.0.0.1）解析，绕回自己 → 所有节点 TLS 握手失败。

修复：把 `system` 换成 `223.5.5.5`（行内数组和块格式都要处理）。

**坑 3：机场会轮换节点密码**

旧凭据导致全部节点握手被重置。必须定时刷新订阅（见下）。

### 3.5 6 小时自动更新（改为每日）

```sh
#!/bin/sh
# /etc/openclash/custom/update-6h.sh
F=/etc/openclash/config/BV.yaml
/usr/share/openclash/openclash.sh "BV" norestart >/dev/null 2>&1
sleep 2
if [ -f "$F" ]; then
    sed -i "/^ *- *system *$/d" "$F"
    sed -i "s/default-nameserver: \[system,/default-nameserver: [223.5.5.5,/" "$F"
    sed -i "s#http://cp.cloudflare.com/generate_204#https://www.gstatic.com/generate_204#g" "$F"
fi
/etc/init.d/openclash restart >/dev/null 2>&1
```

```sh
echo "0 4 * * * /etc/openclash/custom/update-6h.sh" >> /etc/crontabs/root
```

---

## 四、DNS 与去广告

### 4.1 推荐的四层链路

```
设备 → dnsmasq:53（缓存）
     → AdGuard:5353（去广告）
     → mihomo:7874（fake-ip）
     → 国内 DoH（223.5.5.5 / doh.pub / alidns）
```

### 4.2 fake-ip 原理

- 国外域名 → 返回伪造 IP（`198.18.x.x`）
- 设备连接伪造 IP → 被 nftables 重定向到 mihomo
- mihomo 从映射表反查域名 → 按规则走代理

所以**域名规则优先于 IP 规则**，`GEOIP,CN` 只是兜底。

### 4.3 接入 AdGuard

```yaml
# /etc/adguardhome/adguardhome.yaml
dns:
  bind_hosts:
    - 127.0.0.1      # 只监听本机，别暴露到 LAN/WAN
  port: 5353
  upstream_dns:
    - 127.0.0.1:7874
  fallback_dns:
    - 223.5.5.5
    - 119.29.29.29
```

`dnsmasq` 指过去：

```sh
uci set dhcp.@dnsmasq[0].server=''
uci add_list dhcp.@dnsmasq[0].server='127.0.0.1#5353'
uci set dhcp.@dnsmasq[0].noresolv='1'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

> **注意**：必须用 `add_list`，用 `uci set` 写出的"选项"不会生成 `server=` 行，dnsmasq 会拒绝所有查询（REFUSED）。

### 4.4 规则源（国内可达）

```yaml
filter:
  - https://anti-ad.net/easylist.txt
  - https://easylist-downloads.adblockplus.org/easylistchina.txt
  - https://fastly.jsdelivr.net/gh/AdguardTeam/HostlistsRegistry@main/assets/filter_1.txt
```

AdGuard 改 URL 后不会立即重拉，必须 `remove_url` + `add_url`。

### 4.5 DNS 健康看护

```sh
#!/bin/sh
# /etc/openclash/custom/dns-watch.sh
TAG=dns-watch
dns_ok()  { nslookup www.baidu.com 127.0.0.1 >/dev/null 2>&1; }
port_ok() { netstat -ln 2>/dev/null | grep -q ":7874 "; }
set_upstream() {
    uci -q delete dhcp.@dnsmasq[0].server
    uci add_list dhcp.@dnsmasq[0].server="$1"
    uci set dhcp.@dnsmasq[0].noresolv=1
    uci commit dhcp
    /etc/init.d/dnsmasq restart >/dev/null 2>&1
}
[ "$(uci -q get openclash.config.enable)" = "1" ] || exit 0
dns_ok && exit 0
if port_ok; then
    set_upstream "127.0.0.1#5353"
else
    /etc/init.d/openclash restart >/dev/null 2>&1
    sleep 20
    port_ok && set_upstream "127.0.0.1#5353" || set_upstream "223.5.5.5"
fi
```

```sh
echo "*/5 * * * * /etc/openclash/custom/dns-watch.sh >/dev/null 2>&1" >> /etc/crontabs/root
```

---

## 五、稳定性调优

### 5.1 节点别频繁跳

自动组默认 `interval: 300` 且无 `tolerance`，差 1ms 就切节点 → 看视频/刷信息流时 IP 突变，触发平台限流。

```yaml
♻️自动选择:
  type: url-test
  interval: 600     # 10 分钟
  tolerance: 50     # 差 50ms 以内不切
```

### 5.2 开启并行连接

```yaml
tcp-concurrent: true
```

多 A 记录时并行尝试，减少"某个坏 IP 卡 5 秒"。

### 5.3 重启后清 DNS 缓存

OpenClash 重启后伪造 IP 全部重置，客户端缓存里的旧 IP 会失效 30–60 秒。

```sh
# 重启后等 7874 就绪再清
i=0
while [ $i -lt 18 ]; do
    i=$((i+1)); netstat -ln 2>/dev/null | grep -q ":7874 " && break; sleep 5
done
/etc/init.d/dnsmasq restart
curl -s -X POST -u "root:<AdGuard密码>" http://127.0.0.1:3000/control/cache_clear
```

> 注意接口是 `cache_clear`，不是 `cache/clear`（后者 404）。

### 5.4 订阅更新放凌晨

白天每 6 小时重启一次 = 每天两次"抽风窗口"。改成每天 04:00 一次。

---

## 六、按需分流

### 6.1 自定义规则怎么持久化

订阅每 6 小时会覆盖 `BV.yaml`，所以规则要写进**覆盖钩子**：

```
/etc/openclash/custom/openclash_custom_overwrite.sh
```

它每次启动时执行，可以改运行配置。

### 6.2 关键顺序：先加组，再加规则

OpenClash 的流程是「**先校验规则、再执行钩子**」。如果规则引用了钩子里才创建的组，会被判定"组不存在"而**跳过**。

正确做法：**组和规则都写在钩子里**，一次写入。

### 6.3 示例：Spotify 固定出口

```ruby
Value['proxy-groups'] << {
  'name' => '🎵Spotify', 'type' => 'fallback',
  'proxies' => ['🇭🇰1香港...(AnyTLS)', '🇭🇰2香港...(AnyTLS)'],
  'url' => 'https://www.gstatic.com/generate_204', 'interval' => 300
}
rules = ['DOMAIN-SUFFIX,spotify.com,🎵Spotify', ...]
Value['rules'] = rules + Value['rules']
```

### 6.4 示例：Apple Intelligence

```yaml
- DOMAIN-SUFFIX,gateway.icloud.com,♻️自动选择
- DOMAIN-SUFFIX,apple-relay.apple.com,♻️自动选择
- DOMAIN-SUFFIX,mask.icloud.com,♻️自动选择
- DOMAIN,guzzoni.apple.com,♻️自动选择
```

规则源：[RocM301/Apple-Rule](https://github.com/RocM301/Apple-Rule)。

### 6.5 组类型怎么选

| 类型 | 行为 | 适合 |
|---|---|---|
| `url-test` | 自动选最低延迟，会切换 | 通用 |
| `fallback` | 主节点挂了才切 | 流媒体/固定出口 |
| `select` | 完全手动 | 需要绝对稳定 |

---

## 七、WiFi 信道优化

### 7.1 为什么要自动选

邻居 AP 多的时候，固定信道会持续被干扰。一个轻量脚本（`iwinfo scan` + `uci`）即可：

- 2.4G 只在 1/6/11 中选
- 5G 只在非 DFS 的 36/40/44/48/149/153/157/161 中选（兼容 HE80）
- 打分 = 同频/邻频加权信号强度
- **迟滞**：新信道需优于当前 25% 才切
- 切换后 10 秒校验，失败自动回滚

### 7.2 5G 的坑

- 设 `channel=153` 实际可能起在 `149`（80MHz 主信道归一化），验证时要按**频段**判断，别死磕具体数字
- 别选 165：那是 20MHz 专用，HE80 会起不来
- 避开 DFS（52–64），否则雷达检测会断网

### 7.3 中继模式下 5G 不能选

STA 会扫描占用射频，导致 AP 锁不到信道（`Channel: 0`）。

```sh
# 用中继时禁用 STA
uci set wireless.sta.disabled='1'
```

---

## 八、出门在外：酒店与中继

### 8.1 酒店认证页打不开？

因为 fake-ip 把认证重定向"吞"了。需要临时切到认证模式：

```sh
# 关闭代理，DNS 改走上级
uci set openclash.config.enable=0; uci commit openclash
/etc/init.d/openclash stop
uci -q delete dhcp.@dnsmasq[0].server
uci set dhcp.@dnsmasq[0].noresolv=0
uci commit dhcp; /etc/init.d/dnsmasq restart
```

认证完成后**按相反顺序恢复**（先起 OpenClash、等 7874、再切 DNS），否则会断网。

### 8.2 有线 / 中继切换

```sh
# 出门（用中继）
uci set wireless.sta.disabled=0; uci commit wireless; wifi reload
# 回家（用有线）
uci set wireless.sta.disabled=1; uci commit wireless; wifi reload
```

---

## 九、远程访问

### 9.1 Tailscale

```sh
tailscale up --accept-dns=false --hostname=gl-mt3000 --advertise-routes=192.168.8.0/24
```

- `--accept-dns=false`：**关键**，否则会打乱本地 DNS 链
- 子网路由要在管理后台批准

### 9.2 让 Tailscale 访问 LuCI

uhttpd 默认只监听 LAN，需要加 Tailscale IP：

```sh
uci add_list uhttpd.main.listen_http='100.x.x.x:80'
uci add_list uhttpd.main.listen_https='100.x.x.x:443'
uci commit uhttpd; /etc/init.d/uhttpd restart
```

---

## 十、安全加固

### 10.1 SSH 只留密钥

```sh
uci set dropbear.main.PasswordAuth='off'
uci set dropbear.main.RootPasswordAuth='off'
uci set dropbear.main.Interface='lan'
uci commit dropbear; /etc/init.d/dropbear restart
```

> 密钥务必备份，丢了 SSH 就进不去了。

### 10.2 LuCI 免密 + MAC 白名单

免密后任何人连上 Wi-Fi 都能进后台，所以要配套上网白名单：

```sh
uci add firewall rule
uci set firewall.@rule[-1].name='Allow-Admin-Mac'
uci set firewall.@rule[-1].src='lan'
uci set firewall.@rule[-1].src_mac='<设备MAC>'
uci set firewall.@rule[-1].proto='tcp'
uci set firewall.@rule[-1].dest_port='80 443 3000'
uci set firewall.@rule[-1].target='ACCEPT'
uci commit firewall; /etc/init.d/firewall reload
```

注意：新规则必须排在拒绝规则**之前**（`uci reorder`）。

### 10.3 保底通道

1. SSH 密钥（最可靠）
2. 救援 IP：给 Mac 设 `192.168.8.2` 静态 IP，规则里放行
3. 网线口 MAC 白名单

### 10.4 设备 MAC 会变

手机/电脑的「私有 Wi-Fi 地址」是**按 SSID 随机**的。换网络后 MAC 会变，白名单会失效，需要更新。

---

## 十一、排障速查

| 症状 | 最可能原因 | 处理 |
|---|---|---|
| 全部断网，DNS 失败 | dnsmasq 上游配置丢失 | `uci get dhcp.@dnsmasq[0].server`，用 `add_list` 重设 |
| 国外全断、国内正常 | 节点凭据轮换 / `system` 回环 | 跑订阅更新脚本 |
| 看视频/刷信息流卡顿 | 节点切换 / 旧伪造 IP | 调 tolerance、清 DNS 缓存 |
| 后台打不开 | MAC 不在白名单 | 更新白名单或用救援 IP |
| 5G AP 消失 | 中继 STA 占用射频 | 禁用 STA |
| 酒店认证页不弹 | fake-ip 吞了重定向 | 切认证模式 |
| SSH 进不去 | 密钥丢失 | 走救援 IP / 局域网免密 LuCI |

### 通用检查命令

```sh
uptime; free -m; df -h /overlay
for s in openclash adguardhome dnsmasq firewall cron; do
  printf "%-12s " $s; /etc/init.d/$s status >/dev/null 2>&1 && echo ok || echo FAIL
done
curl -s -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/proxies | jq -r '.proxies["♻️自动选择"].now'
nslookup www.baidu.com 127.0.0.1
```

---

## 十二、踩坑清单

1. **新固件默认关 Wi-Fi**，刷完没信号不是砖，插网线即可
2. **中继连上但没网** = `wwan` 没加进 wan 防火墙区
3. **YAML 别用 sed 改**，行内数组和块格式混用会炸
4. **`default-nameserver: [system]`** 会导致 DNS 回环，必须换公共 DNS
5. **机场会轮换密码**，6 小时更新是必要的
6. **`uci set dhcp...server=` 不生效**，必须 `add_list`
7. **AdGuard 改 URL 要 remove + add**，否则不重拉
8. **规则引用新组会被跳过**——组和规则都要写在钩子里
9. **5G 设 153 实际起 149** 是 80MHz 归一化，不是故障
10. **重启后 30–60 秒**旧伪造 IP 失效，属正常
11. **DFS 信道**（52–64）有雷达断网风险，自动选信道要避开
12. **设备随机 MAC** 会失效管理白名单
13. **别在设备上开 1.1.1.1 App**：会绕过整条 DNS/分流链路
14. **OpenClash 的日志级别**默认 info，长期开会产生大量日志，日常用 warning

---

## 附录：最小可用配置速查

```sh
# 一键检查
./scripts/ssh-router.sh 'uptime; free -m'

# 进后台
http://192.168.8.1

# AdGuard
http://192.168.8.1:3000

# 订阅更新
./scripts/ssh-router.sh '/etc/openclash/custom/update-6h.sh'

# DNS 看护日志
./scripts/ssh-router.sh 'logread -e dns-watch'

# 信道切换日志
./scripts/ssh-router.sh 'cat /tmp/chan-select.log'
```