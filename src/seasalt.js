/*
 Seasalt Libsodium Wrapper
 */

class SeaSalt {

    constructor(config) {

        this.version = {
            major: 0,
            minor: 2
        };

        this.config = {
            algorithm: 'xchacha',
            secret: 'changeme3xg4#',
            pwhash: 'argon2'
        };

        this.state = {
            ready: false,
            aead: false
        };

        //  it must be one of these

        if ( ['argon2', 'scrypt'].indexOf(this.config.pwhash) === -1 ) this.config.pwhash = 'argon2';

        //  merge configurations
        if ( typeof config === 'object' )
            for ( i in config )
                if ( config.hasOwnProperty(i) )
                    this.config[i] = config[i];
        if ( typeof this.config.logger === 'undefined' ) this.config.logger = console.log;

        //  link classes
        this.pwhash = {};
        this.pwhash.argon2 = new SeaSalt_PWHash_Argon2;
        this.pwhash.scrypt = new SeaSalt_PWHash_SCrypt;
        this.tools = new SeaSalt_Tools(this.config);
        this.secretbox = new SeaSalt_AEAD_SecretBox(this.config);

        this.aead = {};
        this.aead.xchacha = new SeaSalt_AEAD_XChaCha(this.config);

        this.hash = new SeaSalt_Hashing;

        //  check if jquery is available
        if ( typeof $ === 'undefined' ) {

            return {};

        }

        if ( sodium ) {
            this.config.logger('SeaSalt - Loaded successfully');
            this.state.ready = true;
            this.state.aead = this.aead_test();
            return this;
        } else {
            console.error('SeaSalt - Libsodium was not found');
        }

    }

    //  encrypt the data with the requested algorithm
    encrypt(string, secret, box) {

        if ( !string ) {
            console.error('SeaSalt.encrypt() requires a string or object to encrypt');
            return;
        }

        if ( !secret ) secret = this.config.secret;
        if ( typeof this.aead[this.config.algorithm] === 'object' ) {

            return this.aead[this.config.algorithm].encrypt(string, secret, box);

        } else {

            console.error('SeaSalt.encrypt() received invalid algorithm - ' + this.config.algorithm);

        }

    }

    decrypt(string, secret, box) {

        if ( !string ) {
            console.error('SeaSalt.aead.decrypt() requires a string to decrypt');
            return;
        }

        if ( !secret ) secret = this.config.secret;
        if ( typeof this.aead[this.config.algorithm] === 'object' ) {

            return this.aead[this.config.algorithm].decrypt(string, secret, box);

        } else {

            console.error('SeaSalt.aead.decrypt() received invalid algorithm - ' + this.config.algorithm);

        }

    };

    pwhash_create(password, security, algorithm) {

        if ( !algorithm ) algorithm = this.config.pwhash;
        if ( algorithm && Object.keys(this.pwhash).indexOf(algorithm) === -1 ) algorithm = this.config.pwhash;
        return this.pwhash[algorithm].create(password, security);

    }

    pwhash_verify(hash, password, algorithm) {

        if ( !algorithm ) algorithm = this.config.pwhash;
        if ( algorithm && Object.keys(this.pwhash).indexOf(algorithm) === -1 ) algorithm = this.config.pwhash;
        return this.pwhash[algorithm].verify(hash, password);

    }

    //  test if sodium is working
    test() {

        let result = sodium.to_hex(sodium.crypto_generichash(64, 'test'));
        return ( result === 'a71079d42853dea26e453004338670a53814b78137ffbed07603a41d76a483aa9bc33b582f77d30a65e6f29a896c0411f38312e1d66e0bf16386c86a89bea572' );

    }

    //  test if aead is working
    aead_test() {

        let original = 'test';
        let ciphertext = this.encrypt(original);
        let result = this.decrypt(ciphertext);
        return ( original === result);

    }

}

/* Generic Hashing */

class SeaSalt_Hashing {

    constructor(string, hash, format) {

        this.reservedProperties = ['constructor', 'toString'];
        this.validFormats = ['hex', 'binary', 'base64'];
        if ( typeof string === 'string' ) {

            let props = Object.getOwnPropertyNames(Object.getPrototypeOf(new SeaSalt_Hashing));
            for ( x = 0; x < this.reservedProperties.length; x++ )
                props.splice(props.indexOf(this.reservedProperties[x]), 1);
            props = JSON.parse(JSON.stringify(props));
            if ( typeof hash === 'undefined' ) hash = 'sha256';
            if ( this.validFormats.indexOf(format) === -1 ) format = 'hex';
            if ( props.indexOf(hash) === -1 ) throw "Invalid hash algorithm requested.";
            this.binary = this[hash](string, 'binary');
            this.hex = sodium.to_hex(this.binary);
            this.base64 = sodium.to_base64(this.binary);
            this.format = format;
            this.length = this[this.format].length;

        }

    }

    toString() {

        return this.hex;

    }

    sha256(string, format) {

        if ( !format ) format = 'hex';
        if ( this.validFormats.indexOf(format) === -1 ) format = 'hex';
        let result = sodium.crypto_hash_sha256(string);
        if ( format === 'hex' ) return sodium.to_hex(result);
        if ( format === 'base64' ) return sodium.to_base64(result);
        return result;

    }

    sha512(string, format) {

        if ( !format ) format = 'hex';
        if ( this.validFormats.indexOf(format) === -1 ) format = 'hex';
        let result = sodium.crypto_hash_sha512(string);
        if ( format === 'hex' ) return sodium.to_hex(result);
        if ( format === 'base64' ) return sodium.to_base64(result);
        return result;

    }

}

/* PWHash Classes */

//
//  Argon2 Password Hashing
//
class SeaSalt_PWHash_Argon2 {

    create(password, security) {

        let opsLimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE;

        if ( !security ) security = 'normal';
        if ( ['light', 'normal', 'moderate', 'high'].indexOf(security) === -1 ) security = 'normal';
        if ( security === 'normal' ) {

            opsLimit = opsLimit*2;

        } else if ( security === 'moderate' ) {

            opsLimit = opsLimit*4;

        } else if ( security === 'high' ) {

            opsLimit = opsLimit*6;

        }

        return sodium.crypto_pwhash_str(password, opsLimit, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE);

    }

    verify(hash, password) {

        return sodium.crypto_pwhash_str_verify(hash, password);

    }

}

//
//  SCrypt Password Hashing
//
class SeaSalt_PWHash_SCrypt {

    create(password, security) {

        let opsLimit = sodium.crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_INTERACTIVE;
        let memLimit = sodium.crypto_pwhash_scryptsalsa208sha256_MEMLIMIT_INTERACTIVE;

        if ( !security ) security = 'normal';
        if ( ['light', 'normal', 'moderate', 'high'].indexOf(security) === -1 ) security = 'normal';
        if ( security === 'normal' ) {

            opsLimit = sodium.crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_INTERACTIVE*3;

        } else if ( security === 'moderate' ) {

            opsLimit = (sodium.crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_INTERACTIVE+sodium.crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_SENSITIVE)*0.25;

        } else if ( security === 'high' ) {

            opsLimit = sodium.crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_SENSITIVE;

        }

        let result = sodium.crypto_pwhash_scryptsalsa208sha256_str(password, opsLimit, memLimit);
        sodium.memzero(password);
        return result;

    }

    verify(hash, password) {

        let result = sodium.crypto_pwhash_scryptsalsa208sha256_str_verify(hash, password);
        sodium.memzero(password);
        return result;

    }

}

/* AEAD Classes */

//
//  Secret Box
//
class SeaSalt_AEAD_SecretBox {

    constructor(userPassword, secretItem, config) {

        this.config = {
            minimumEntropy: 1,
            minimumKeyLength: 1,
            minimumStrength: 0,
            logger: console.log
        };
        if ( typeof userPassword === 'object' ) {

            config = userPassword;
            userPassword = undefined;
            secretItem = undefined;

        }

        if ( typeof config === 'object' )
            for ( let i in config )
                if ( config.hasOwnProperty(i) )
                    this.config[i] = config[i];

        this.hash = new SeaSalt_Hashing;
        this.tools = new SeaSalt_Tools(config);
        this.aead = new SeaSalt_AEAD_XChaCha(config);

        if ( userPassword ) this.box = this.create(userPassword, secretItem);

    }

    toString() {
        return this.box;
    }

    //  create a secret aead box
    create(userPassword, secretItem) {

        //  return a box if it already exists
        if ( this.box ) return this.box;

        //  enforce any minimum password strength
        if ( this.tools.passwordStrength(userPassword) < this.config.minimumStrength ) throw "Supplied password does not meet the minimum strength requirements.";

        //  parse the box contents into a string
        if ( typeof secretItem === 'boolean' ) secretItem = ( secretItem === false ) ? "false" : "true";
        if ( typeof secretItem === 'number' ) secretItem = secretItem.toString();
        if ( typeof secretItem === 'object' ) secretItem = JSON.stringify(secretItem, true, 5);
        if ( typeof secretItem === 'undefined' ) secretItem = this.aead.key();
        if ( typeof secretItem !== 'string' ) throw "Supplied secret item cannot be converted to a string.";

        //  wrap the box
        this.box = this.aead.encrypt(secretItem, userPassword);

        //  verify the box
        let contents = this.aead.decrypt(this.box, userPassword);
        if ( contents !== secretItem ) {
            this.config.logger('SeaSalt/AEAD/box_create - Failed to validate box contents');
            throw "Failed to validate the box contents.";
        }

        //  return the box
        return this.box;

    }

    //  repackage a box
    repackage(box, userPassword, newPassword) {

        if ( !box && !this.box ) throw "Secret box must be provided for repackaging.";
        if ( box && userPassword && !newPassword ) {

            if ( !this.box ) throw "Secret box must be provided for repackaging.";
            newPassword = userPassword;
            userPassword = box;
            box = this.box;

        }

        if ( !box || !userPassword || !newPassword ) throw "Required arguments are missing";

        //  enforce any minimum password strength
        if ( this.tools.passwordStrength(newPassword) < this.config.minimumStrength ) return;

        //  open the box
        let contents = this.aead.decrypt(box, userPassword);

        //  return the original box if we failed to open it
        if ( typeof contents !== 'string' ) return box;

        //  repackage the contents and return the new box
        this.box = this.create(newPassword, contents);
        return this.box;

    }

    //  check if a secret item matches the contents of a box
    check(box, userPassword, secretItem) {

        if ( !box && !this.box ) throw "Secret box must be provided for checking.";
        if ( box && userPassword && !secretItem ) {

            if ( !this.box ) throw "Secret box must be provided for repackaging.";
            secretItem = userPassword;
            userPassword = box;
            box = this.box;

        }

        if ( !box || !userPassword || !secretItem ) throw "Required arguments are missing";

        if ( typeof secretItem === 'boolean' ) secretItem = ( secretItem === false ) ? "false" : "true";
        if ( typeof secretItem === 'number' ) secretItem = secretItem.toString();
        if ( typeof secretItem === 'object' ) secretItem = JSON.stringify(secretItem, true, 5);
        if ( typeof secretItem !== 'string' ) return;

        let contents = this.aead.decrypt(box, userPassword);
        return ( contents === secretItem );

    }

}

//
//  XChaCha20-Poly1305-IETF AEAD Methods
//
class SeaSalt_AEAD_XChaCha {

    constructor(string, secret, box, config) {

        if ( (typeof box === 'object' || typeof secret === 'object') && typeof config === 'undefined' ) {

            if ( typeof secret === 'object' ) {
                config = secret;
                secret = undefined;
                box = undefined;
            }

            if ( typeof box === 'object' && !(box instanceof SeaSalt_AEAD_SecretBox) ) {
                config = box;
                box = undefined;
            }

        }

        this.config = {
            minimumEntropy: 1,
            minimumKeyLength: 1,
            minimumStrength: 0,
            logger: console.log
        };

        if ( typeof string === 'object' ) {

            config = string;
            string = undefined;

        }

        if ( typeof config === 'object' )
            for ( let i in config )
                if ( config.hasOwnProperty(i) )
                    this.config[i] = config[i];

        this.hash = new SeaSalt_Hashing;
        this.tools = new SeaSalt_Tools;

        //  load any secretbox
        if ( box instanceof SeaSalt_AEAD_SecretBox && box.box ) this.box = box.box;
        if ( typeof box === 'string' ) this.box = box;

        //  run encryption if string is provided
        if ( typeof string === 'string' ) this.encrypt(string, secret, box);

    }

    encrypt(string, secret, box) {

        if ( !string || !secret ) {
            console.error('SeaSalt_AEAD_XChaCha::encrypt requires a string or secret to encrypt');
            return;
        }

        //  it's the box-box
        if ( typeof box === 'undefined' && this.box ) box = this.box;
        if ( box instanceof SeaSalt_AEAD_SecretBox && typeof box.box === 'string' ) {
            box = box.box;
        } else if ( box && typeof box !== 'string' ) {
            console.error('SeaSalt_AEAD_XChacha::decrypt supplied SecretBox is invalid');
            return;
        }

        //  open a box to obtain the secret key
        if ( typeof box === 'string' ) {

            this.box = box;
            let contents = this.decrypt(box, secret, false);
            if ( typeof contents === 'string' ) {

                secret = contents;
                this.config.logger('SeaSalt_AEAD_XChaCha::encrypt using secret box');

            } else throw "Failed to decrypt secret box.";

        }

        let nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        let key = sodium.from_hex(this.hash.sha256(secret));
        let ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(string, '', '', nonce, key);
        sodium.memzero(key);
        this.ciphertext = sodium.to_hex(nonce) + sodium.to_hex(ciphertext);
        return this.ciphertext;

    };

    decrypt(string, secret, box) {

        if ( !string || !secret ) {
            console.error('SeaSalt_AEAD_XChaCha::decrypt requires a string and secret to decrypt');
            return;
        }

        //  it's the box-box
        if ( typeof box === 'undefined' && this.box ) box = this.box;
        if ( box instanceof SeaSalt_AEAD_SecretBox && typeof box.box === 'string' ) {
            box = box.box;
        } else if ( box && typeof box !== 'string' ) {
            console.error('SeaSalt_AEAD_XChacha::decrypt supplied SecretBox is invalid');
            return;
        }

        //  open a box to obtain the secret key
        if ( typeof box === 'string' ) {

            this.box = box;
            let contents = this.decrypt(box, secret, false);
            if ( typeof contents === 'string' ) {

                secret = contents;
                this.config.logger('SeaSalt_AEAD_XChaCha::decrypt using secret box');

            } else throw "Failed to decrypt secret box.";

        }

        let nonce;
        let ciphertext;
        try {
            nonce = sodium.from_hex(string.substr(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES*2));
            ciphertext = sodium.from_hex(string.substr(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES*2, string.length));
        } catch (e) {
            return undefined;
        }
        let key = sodium.from_hex(this.hash.sha256(secret));
        let result = '';
        try {
            result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt('', ciphertext, '', nonce, key);
        } catch (e) {}
        sodium.memzero(key);
        return ( result ) ? sodium.to_string(result) : undefined;

    };

    //  generate a random key
    key() {

        return sodium.to_hex(sodium.crypto_aead_xchacha20poly1305_ietf_keygen());

    }

    //  output relevant json package
    toJSON() {

        var data = {
            box: this.box,
            ciphertext: this.ciphertext
        };
        return JSON.stringify(data, true, 5);

    }

}

/* SeaSalt Tools */
class SeaSalt_Tools {

    constructor(config) {

        this.config = {
            minimumEntropy: 6,
            minimumKeyLength: 6,
            minimumStrength: 1
        };
        if ( typeof config === 'object' )
            for ( let i in config )
                if ( config.hasOwnProperty(i) )
                    this.config[i] = config[i];
        if ( typeof this.config.logger === 'undefined' ) this.config.logger = console.log;

    }

    passwordStrength(password) {

        //  check password strength
        let strength = 0;
        let cat = 0;
        let matches = {};

        //  lowercase alpha chars
        if ( matches.alpha = password.match(/[a-z]/g) ) strength++;

        //  uppercase alpha chars
        if ( matches.caps = password.match(/[A-Z]/g) ) strength++;

        //  numeric chars
        if ( matches.numeric = password.match(/[0-9]/g) ) strength++;

        //  symbol chars
        if ( matches.symbol = password.match(/[-!$%^&*()_+|~=`{}\[\]:#";'@<>?,.\/]/g) ) strength++;

        //  calculate entropy
        cat = strength;
        let chars = [];
        for ( let i in matches )
            if ( matches.hasOwnProperty(i) )
                if ( typeof matches[i] === 'object' && matches[i] !== null && matches[i].length )
                    for ( let x = 0; x < matches[i].length; x++ )
                        if ( chars.indexOf(matches[i][x].toLowerCase()) === -1 ) chars.push(matches[i][x].toLowerCase());

        //  adjust strength calculation

        //  supplied chars meeting minimum entropy are given a bonus
        if ( chars.length >= this.config.minimumEntropy ) strength = strength++;

        //  supplied chars below minimum entropy are heavily penalized
        if ( chars.length < this.config.minimumEntropy ) strength = strength-3;

        //  weak strength but extremely long is given a bonus
        if ( strength === 1 && password.length >= (this.config.minimumKeyLength*2) ) strength++;

        //  short passwords are penalized
        if ( password.length < (this.config.minimumKeyLength+4) ) strength--;

        //  only one type of charset is penalized
        if ( cat === 1 ) strength--;

        //  passwords shorter than the minimum length are invalid
        if ( password.length < this.config.minimumKeyLength ) strength = 0;

        //  return strength out of a maximum of 4
        if ( strength < 0 ) strength = 0;
        if ( strength > 4 ) strength = 4;
        return strength;

    };

}

//  AES-256-GCM not supported in browser library
