let chunks = [];
let requestId;
let stream;
let mediaRecorder;

function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function chooseDesktopMedia(videoMediaSource) {
  return new Promise(resolve => {
    chrome.desktopCapture.chooseDesktopMedia([videoMediaSource || 'window', 'screen', 'tab'],
      async (id) => { resolve(id) })
  })
}

function onOpenEditorTab(recordedChunks, vidMimeType) {
  let newwindow = window.open('../editor.html');
  newwindow.recordedChunks = recordedChunks;
  newwindow.vidMimeType = vidMimeType;
  chunks = [];
  requestId = 0;
  stream = null;
  mediaRecorder = null;
}

const grantMicrophonePermission = async (request) => {
  const permission = await navigator.permissions.query({ name: 'microphone' });
  if (permission.state !== 'granted') {
    let params = '';
    let len = Object.keys(request).length - 1;

    for (const [key, value] of Object.entries(request)) {
      if (key) params += `${key}=${value}${len > 1 ? '&' : ''}`;
      len--;
    }

    chrome.windows.create({
      url: chrome.extension.getURL('../permission/index.html?' + params), width: 400, height: 400, type: 'popup'
    });
  }
  return permission.state;
}

const onMessage = async (request) => {
  // screen sharing recording
  if (request.message === 'start-record' && request.videoMediaSource) {

    const permissionState = await grantMicrophonePermission(request);
    if (permissionState !== 'granted') return;

    await delay(100);
    requestId = await chooseDesktopMedia(request.videoMediaSource);

    await sendMessageToContent({ ...request, message: 'background-start-record' });

    const constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: requestId,
        },
        // width: { min: 640, ideal: 1920, max: 3840, },
        // height: { min: 480, ideal: 1080, max: 2160, },
        // aspectRatio: 1.777,
        // frameRate: { min: 5, ideal: 15, max: 30, }
      }, audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaRecorder = new MediaRecorder(stream, { mimeType: request.mimeType });

    if (request.enableAudio) {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: request.audioDeviceID } });
      audioStream.getAudioTracks()[0].enabled = request.enableAudio;
      stream.addTrack(audioStream.getAudioTracks()[0]);
    }

    mediaRecorder.start();

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
    }

    mediaRecorder.onstop = async () => {
      await sendMessageToContent({ ...request, message: 'background-stop-record' });
      onOpenEditorTab(chunks, request.mimeType);
    }

    mediaRecorder.onerror = async event => {
      await sendMessageToContent({ message: 'background-stop-record' });
      console.error(`Error recording stream: ${event.error.name}`);
    }

    stream.getVideoTracks()[0].onended = async () => {
      mediaRecorder.stop();
      if (request.enableCamera) await sendMessageToContent({ message: 'background-stop-record' });
    };
  }

  // // only audio recording
  if (request.message === 'start-record' && request.enableAudio && !request.videoMediaSource) {
    try {
      const permissionState = await grantMicrophonePermission(request);
      if (permissionState !== 'granted') return;

      await delay(100);

      stream = await navigator.mediaDevices.getUserMedia({
        video: false, audio: request.enableAudio
      });

      mediaRecorder = new MediaRecorder(stream, { mimeType: request.mimeType });

      mediaRecorder.start();
      await sendMessageToContent({ ...request, message: 'background-start-record' });

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      }

      mediaRecorder.onstop = async () => {
        onOpenEditorTab(chunks, request.mimeType);        
        await sendMessageToContent({ ...request, message: 'background-stop-record' });
      }

      mediaRecorder.onerror = event => {
        console.error(`Error recording stream: ${event.error.name}`);
      }

      stream.getVideoTracks()[0].onended = async () => {
        mediaRecorder.stop();
      };
    } catch (error) {
      console.log('start-record audio', error);
    }
  }

  if (request.message.includes('stop-record')) {
    try {
      if (stream) stream.getTracks().forEach((track) => { track.stop(); });
      if (mediaRecorder) mediaRecorder.stop();
      await sendMessageToContent({ ...request, message: 'background-stop-record' });
    } catch (error) {
      console.log('Background stop-record', error);
    }
  }

  if (request.message === 'pause-record') {
    if (mediaRecorder) mediaRecorder.pause();
  }

  if (request.message === 'resume-record') {
    if (mediaRecorder) mediaRecorder.resume();
  }

  if (request.message === 'content-microphone' && stream && stream.getAudioTracks().length > 0) {
    stream.getAudioTracks()[0].enabled = request.muted;
  }

  if (request.message === 'grant') {
    await sendMessageToContent({ ...request, message: 'start-record' })
  }
};

function sendMessageToContent(message) {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, message); resolve();
    })
  })
}

chrome.runtime.onMessage.addListener(onMessage);
