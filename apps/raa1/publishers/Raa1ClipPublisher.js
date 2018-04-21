const Clip = require('../../../entities/Clip').Clip;

const AppContext = require('../../../AppContext');
const ClipPublisher = require('../../../publishers/ClipPublisher');

const execSync = require('child_process').execSync;
const fs = require('fs');
const {URL} = require('url');
const path = require('path');
const md5 = require('md5');
const uuid = require('uuid/v1');

class Raa1ClipPublisher extends ClipPublisher {
    constructor(credentialsConf) {
        super();
        // Initiate AWS connection
        if (credentialsConf.AWS) {
            this._syncS3 = new SyncS3(
                AppContext.getInstance().CWD + '/' + credentialsConf.AWS,
                'vod.raa.media'
            );
        } else {
            throw Error(
                'AWS config not found! Cannot proceed' + ' with ClipPublisher constructor'
            );
        }
    }

    /**
     * Merges clips to a single one and posts it somewhere available to public
     * (e.g. Public S3)
     * @param {Clip[]} clips clips to be mereged
     * @param {String} publicClipNamingStrategy states how the public clip should
     *  be named. Options are 'MainClip', 'AllClips'
     * @return {Clip} the public clip object
     */
    getPublicClip(clips, publicClipNamingStrategy = 'MainClip') {
        let wrappedClip = new WrappedClip(clips, publicClipNamingStrategy);

        AppContext.getInstance().Logger.debug(
            'S3 upload key is: ' + wrappedClip.RelativePath
        );
        if (
            !(
                AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode ||
                AppContext.getInstance('LineupGenerator').GeneratorOptions.NoVODUpload
            )
        ) {
            wrappedClip.wrap();
            try {
                let self = this;
                // We upload programs if we are wrapping something
                // (they might be updated). However, if original clip is
                // being uploaded, we should only care to upload when
                // the file does not exsit on S3.
                if (
                    wrappedClip.IsWrapped ||
                     !(self._syncS3.exists(wrappedClip.RelativePath))
                ) {
                    self._syncS3.putObject(wrappedClip.RelativePath,
                                                        wrappedClip.AbsolutePath);
                    // Remove the temp file
                    if (wrappedClip.IsWrapped) {
                            fs.unlinkSync(wrappedClip.AbsolutePath);
                    }
                } else {
                    AppContext.getInstance()
                        .Logger.debug(`Not uploading ${wrappedClip.RelativePath}. ` +
                            'Either not wrapped or already exists in S3.');
                }
            } catch (e) {
                throw Error('Error while uploading public clip. Inner exception is ' + e);
            }
        }

        return wrappedClip.PublicClip;
    }
}

class WrappedClip {
    constructor(clips, publicClipNamingStrategy) {
        this._clips = clips;
        this._publicClipNamingStrategy = publicClipNamingStrategy;

        this._absolutePath = null;
        this._relativePath = null;
        this._duration = 0;
        this._name = '';

        this._publicClip = null;

        this.init();
    }

    init() {
        this.buildPublicClip();

        if (this.IsWrapped) {
            this._publicClip.Description = this._clips
                .map((clip) => clip.Media.Description)
                .join(';');
        }
    }

    buildPublicClip() {
        if (this.IsWrapped) {
            this._allMediaPath = '';

            for (let clip of this._clips) {
                this._allMediaPath = this._allMediaPath + clip.Media.Path + '|';
                this._duration += clip.Media.Duration;

                if (clip.IsMainClip) {
                    this._relativePath = path
                        .dirname(clip.Media.Path)
                        .replace(
                            AppContext.getInstance('LineupGenerator').LineupManager
                                .MediaDirectory.BaseDir,
                            ''
                        )
                        .replace(/^\/+/g, ''); // also remove any '/' at the beginning
                    if (this._publicClipNamingStrategy == 'MainClip') {
                        this._name = clip.Media.Path.substring(
                            clip.Media.Path.lastIndexOf('/') + 1
                        );
                    }
                    this._publicClip = new Clip(clip);
                }
            }

            if (this._publicClipNamingStrategy == 'AllClips') {
                this._name = md5(this._allMediaPath) + '.mp3';
            }

            this._relativePath = path.join(this._relativePath, this._name);

            // tmp filename is a uuid to prevent name clashing
            this._absolutePath =
                AppContext.getInstance().CWD + '/run/tmp/' + uuid() + '.mp3';
        } else {
            this._absolutePath = this._clips[0].Media.Path;
            this._relativePath = this._clips[0].Media.Path.replace(
                AppContext.getInstance('LineupGenerator').LineupManager.MediaDirectory
                    .BaseDir,
                ''
            ).replace(/^\/+/g, ''); // also remove any '/' at the beginning
            this._name = this._relativePath.substring(
                this._relativePath.lastIndexOf('/') + 1
            );
            this._duration = this._clips[0].Media.Duration;

            this._publicClip = new Clip(this._clips[0]);
        }

        let vodUrl = new URL(this._relativePath, 'http://vod.raa.media/');
        vodUrl =
            'https://api.raa.media/linkgenerator/podcast.mp3?src=' +
            Buffer.from(vodUrl.toString()).toString('base64');
        // Return the clip
        this._publicClip.Media.Path = vodUrl;
        this._publicClip.Media.Duration = this._duration;
    }

    wrap() {
        if (this.IsWrapped) {
            let wrapCmd =
                'echo y | ffmpeg -i "concat:' +
                this._allMediaPath +
                '" -ac 2 ' +
                this._absolutePath +
                ' 2>&1 >/dev/null';

            try {
                if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode) {
                    AppContext.getInstance().Logger.debug(
                        'Clip wrapping cmd is: ' + wrapCmd
                    );
                } else {
                    AppContext.getInstance().Logger.info(
                        `Resource intensive process is starting: ${wrapCmd}`
                    );
                    execSync(wrapCmd);
                    AppContext.getInstance().Logger.info('External process finished.');
                }
            } catch (error) {
                throw Error(
                    'Merging clips was unsuccessful. Error was: ' + error.message
                );
            }
        }
    }

    get PublicClip() {
        return this._publicClip;
    }

    get AbsolutePath() {
        return this._absolutePath;
    }

    get RelativePath() {
        return this._relativePath;
    }

    get Name() {
        return this._name;
    }

    get Duration() {
        return this._duration;
    }

    get IsWrapped() {
        return this._clips.length > 1 ? true : false;
    }
}

class SyncS3 {
    constructor(confPath, bucket) {
        this._confPath = confPath;
        this._bucket = bucket;
    }

    exists(key) {
        try {
            execSync('node ' + __dirname + '/s3-check-exists.js ' + this._confPath +
                                                    + ' ' + this._bucket + ' ' + key);
            return true;
        } catch (error) {
            if (error.status == 1) {
                return false;
            } else {
                throw (error.stdout);
            }
        }
    }

    putObject(key, filePath) {
        let params = {
            Bucket: this._bucket,
            Key: key,
        };

        AppContext.getInstance().Logger.debug(
            `Attempting uploading to S3 with key: ${params.Key}`
        );

        try {
            execSync('node ' + __dirname + '/s3-put-object.js ' + this._confPath +
                                ' ' + this._bucket + ' ' + key + ' ' + filePath);
            AppContext.getInstance().Logger.info(
                                'Successfully uploaded item to S3: ' + key);
        } catch (error) {
            AppContext.getInstance().Logger.error(
                'Error uploading file to S3. Error is: ' + error
            );
        }
    }
}

module.exports = Raa1ClipPublisher;
