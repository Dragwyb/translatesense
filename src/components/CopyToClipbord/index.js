
const copyToClipboard = async ({
    value = '',
    onCopy = () => { },
    onSuccess = () => { },
    resetDelay = 1000,
} = {}) => {
    if (value == null || value === '') return false;

    try {
        const text = String(value);

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');

            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';

            document.body.appendChild(textarea);
            textarea.select();

            const copied = document.execCommand('copy');
            textarea.remove();

            if (!copied) {
                throw new Error('Unable to copy text.');
            }
        }

        onCopy();

        if (resetDelay > 0) {
            setTimeout(onSuccess, resetDelay);
        } else {
            onSuccess();
        }

        return true;
    } catch (error) {
        onError(error);
        return false;
    }
};

export default copyToClipboard;