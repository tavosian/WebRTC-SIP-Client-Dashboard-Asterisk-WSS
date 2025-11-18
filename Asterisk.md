# Asterisk WebRTC WSS Configuration - Full Single Copy

[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8089
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlsprivatekey=/etc/asterisk/keys/asterisk.key
tlscertfile=/etc/asterisk/keys/asterisk.crt

# Generate cert if needed
# ast_tls_cert create

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0

[your-username]
type=endpoint
context=from-webrtc
disallow=all
allow=opus
allow=ulaw
transport=transport-wss
aors=your-username
auth=your-username
webrtc=yes
dtls_auto_generate_cert=yes

[your-username]
type=auth
auth_type=userpass
username=your-username
password=your-password

[your-username]
type=aor
max_contacts=5

[from-webrtc]
exten => your-extension-to-call,1,Answer()
 same => n,Playback(hello-world)
 same => n,Hangup()

# Restart Asterisk
# sudo systemctl restart asterisk
