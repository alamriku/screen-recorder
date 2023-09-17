import { h, Fragment } from 'preact';
import { useCallback, useState } from 'preact/hooks';

 import * as tus from './tus'

import Draggable from './components/Draggable';
import Timer from './components/Timer';
import downloadVideo from './utils/downloadVideo';
import record from './utils/record';

import ButtonMove from './components/button/ButtonMove';
import ButtonPause from './components/button/ButtonPause';
import ButtonPlay from './components/button/ButtonPlay';
import ButtonResume from './components/button/ButtonResume';
import ButtonStop from './components/button/ButtonStop';
import ButtonDownload from './components/button/ButtonDownload';

import ButtonMicOn from './components/button/ButtonMicOn';
import ButtonMicOff from './components/button/ButtonMicOff';

import createLink from './utils/createLink';
import ButtonOpenEditor from './components/button/ButtonOpenEditor';
import ButtonClose from './components/button/ButtonClose';

const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

function App({ request }) {
  const { tabTitle, autoDownload, enableTimer, enableCamera, isMicrophoneConnected } = request;

  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecordingPlay, setIsRecordingPlay] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);

  const [audioStream, setAudioStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(enableCamera);

  const [isAppClosed, setIsAppClosed] = useState(false);

  const chunks = [];
  let bytesTotal = 0;
  let mediaId = null;

  const onMediaControl = async (actionType) => {
    try {
      if (actionType === 'play' && mediaRecorder === null) {
        const { mediaRecorder, stream, audioStream } = await record(request);

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => { track.stop(); });

          setMediaRecorder(null);
          setIsRecordingPlay(false);
          setIsRecordingFinished(true);

          console.log('mediaRecorder.onstop: recording is stopped');
          if (autoDownload) onDownload();

          uploadToCloudflare()
        }

        mediaRecorder.ondataavailable = (e) => {
          chunks.push(e.data);
          bytesTotal += e.data.size;
        }        

        setMediaRecorder(mediaRecorder);
        setAudioStream(audioStream);
        setIsRecordingPlay(true);
      }

      if (actionType === 'stop' && mediaRecorder) { mediaRecorder.stop(); }

      if (actionType === 'pause' && mediaRecorder) {
        mediaRecorder.pause();
        setIsRecordingPaused(true);
      }

      if (actionType === 'resume' && mediaRecorder) {
        mediaRecorder.resume();
        setIsRecordingPaused(false);
      }
    } catch (error) {
      console.log('Recording: ', error);
      setIsMicOn(false);
    }
  }

  const onMicControl = () => {
    if (audioStream && audioStream.getTracks().length > 0) {
      const state = !isMicOn;
      audioStream.getTracks().forEach((track) => { track.enabled = state });
      setIsMicOn(state);
    }
  }

  const onDownload = useCallback(() => {
    downloadVideo(chunks, tabTitle || 'reco', 'video/webm');
  }, []);

  const onOpenEditor = useCallback(async () => {
    const videoURL = createLink(chunks);
    const videoLen = +localStorage.getItem('reco-timer');
    await chrome.runtime.sendMessage({ from: 'content', videoURL, videoLen, tabTitle });
  }, []);

  const onDeleteRecording = () => {
    if(window.confirm('Do you really want to delete this?')) {
      setIsAppClosed(true)
    }
  }

  const getVideoUrlById = async () => {
    // here we will call the backend to get the url. we will set get request with the stream-media-id
  }

  const getExpiryDate = () => {
    let theDate = new Date();
    theDate.setHours(theDate.getHours() + 5);
    return theDate.toISOString();
  };

  const startUpload = (file, chunkSize, endpoint) =>  {
    console.log(file.name);
    const options = {
      endpoint: endpoint,
      chunkSize: 5 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        expiry: getExpiryDate(),
        maxDurationSeconds: 3600,
        name: file.name,
      },
      onError(error) {
        console.log(error);
      },
      onSuccess() {
        console.log('Upload finished');
      },
      onProgress(bytesUploaded) {
        let percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(bytesUploaded, bytesTotal, percentage + '%');
      },
      onAfterResponse: function (req, res) {
        return new Promise(resolve => {
          let mediaIdHeader = res.getHeader('Stream-Media-ID');
          console.log(mediaIdHeader);
          if (mediaIdHeader) {
            getVideoUrlById();
            mediaId = mediaIdHeader;
          }
          resolve();
        });
      },
    };

    let tusUpload = new tus.Upload(file, options);
    // Check if there are any previous uploads to continue.
    tusUpload.findPreviousUploads().then(function (previousUploads) {
      // Found previous uploads so we select the first one.
      if (previousUploads.length) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0])
      }

      // Start the upload
      tusUpload.start()
    })
  }

  const uploadToCloudflare = () => {
    const fileName = "video_file_" + Math.floor(Date.now() / 1000) + ".webm";
    const videoBlob = new Blob(chunks, { type: 'video/webm' });

// Create a File object with the Blob and filename
    const videoFile = new File([videoBlob], fileName, { type: 'video/webm' });
    //let endpoint = 'https://worker-sites-template.badrul-d3f.workers.dev/upload'
    let endpoint = 'http://127.0.0.1:8787/upload'
    startUpload(videoFile, bytesTotal, endpoint);
  }

  if ((autoDownload && isRecordingFinished) || isAppClosed) {
    return <Fragment></Fragment>
  }

  if (isRecordingFinished) {
    return <Draggable className="drag-reco" style={{ left: '20px' }}>
      <ButtonMove />
      {!autoDownload && <ButtonClose onClick={onDeleteRecording} className="red" title="Delete Record" />}
      {!autoDownload && !isFirefox && <ButtonOpenEditor onClick={onOpenEditor} />}
      {!autoDownload && <ButtonDownload onClick={onDownload} />}
    </Draggable>
  }
  else {
    return <Fragment>
      <Draggable className="drag-reco" style={{ left: '20px' }}>

        <ButtonMove />

        {isMicrophoneConnected && <Fragment>
          {isMicOn
            ? <ButtonMicOn onClick={onMicControl} />
            : <ButtonMicOff onClick={onMicControl} />}
        </Fragment>}

        {enableTimer && <Timer isRecordingPlay={isRecordingPlay} isRecordingPaused={isRecordingPaused} />}

        {isRecordingPlay
          ? <Fragment>
            <ButtonStop onClick={() => { onMediaControl('stop') }} title='Stop Recording' />
            {isRecordingPaused
              ? <ButtonResume onClick={() => { onMediaControl('resume') }} />
              : <ButtonPause onClick={() => { onMediaControl('pause') }} />}
          </Fragment>

          : <ButtonPlay onClick={() => { onMediaControl('play') }} />}
      </Draggable>
    </Fragment>
  }


}

export default App;
