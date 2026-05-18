from pydub import AudioSegment


def pad_audio(input_path, output_path, silence_start_ms, silence_end_ms):
    audio = AudioSegment.from_file(input_path)
    silence_start = AudioSegment.silent(duration=silence_start_ms)
    silence_end = AudioSegment.silent(duration=silence_end_ms)
    padded = silence_start + audio + silence_end
    padded.export(output_path, format="wav")
    return len(padded)

