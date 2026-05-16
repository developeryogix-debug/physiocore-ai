import gradio as gr
import spaces
import json
import base64
import time


@spaces.GPU(duration=60)
def analyse_pose(payload_str: str):
    import torch
    import numpy as np
    from PIL import Image
    import io

    try:
        data = json.loads(payload_str)
        image_b64 = data.get("image_base64", "")

        if not image_b64 or image_b64 == "test":
            return json.dumps({
                "sapiensAvailable": True,
                "landmarks": [],
                "message": "health_check_ok",
                "gpu": str(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu")
            })

        # Decode image
        img_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Import Sapiens inside GPU context to avoid module-level CUDA init
        from transformers import AutoImageProcessor, AutoModelForKeypointDetection

        processor = AutoImageProcessor.from_pretrained(
            "facebook/sapiens-pose-1b",
            cache_dir="/tmp/sapiens_cache"
        )
        model = AutoModelForKeypointDetection.from_pretrained(
            "facebook/sapiens-pose-1b",
            cache_dir="/tmp/sapiens_cache"
        ).to("cuda" if torch.cuda.is_available() else "cpu")

        inputs = processor(images=image, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)

        # Extract keypoints
        keypoints = outputs.keypoints[0].cpu().numpy()
        scores = outputs.keypoint_scores[0].cpu().numpy()

        w, h = image.size

        # COCO keypoint index → MediaPipe landmark index
        # Covers joints used by ROM assessment (shoulder, hip, knee, ankle, heel)
        COCO_TO_MEDIAPIPE = {
            0:  0,   # nose
            5:  11,  # left shoulder
            6:  12,  # right shoulder
            7:  13,  # left elbow
            8:  14,  # right elbow
            9:  15,  # left wrist
            10: 16,  # right wrist
            11: 23,  # left hip
            12: 24,  # right hip
            13: 25,  # left knee
            14: 26,  # right knee
            15: 27,  # left ankle
            16: 28,  # right ankle
        }

        landmarks = []
        for coco_idx, mp_idx in COCO_TO_MEDIAPIPE.items():
            if coco_idx < len(keypoints):
                x, y = keypoints[coco_idx]
                score = float(scores[coco_idx])
                landmarks.append({
                    "mediapipe_index": mp_idx,
                    "x": float(x) / w,
                    "y": float(y) / h,
                    "z": 0.0,
                    "confidence": score
                })

        return json.dumps({
            "sapiensAvailable": True,
            "landmarks": landmarks,
            "landmarkCount": len(landmarks)
        })

    except Exception as e:
        return json.dumps({
            "sapiensAvailable": False,
            "error": str(e),
            "fallback": "mediapipe"
        })


with gr.Blocks() as demo:
    gr.Markdown("# PhysioCore Sapiens Pose API")
    gr.Markdown("Pass `{\"image_base64\": \"...\"}` or `{\"image_base64\": \"test\"}` for health check.")

    with gr.Row():
        payload_in = gr.Text(label="JSON payload", placeholder='{"image_base64": "test"}')
        result_out = gr.Text(label="Landmarks JSON")

    btn = gr.Button("Analyse")
    btn.click(analyse_pose, inputs=payload_in, outputs=result_out)

    gr.Interface(
        fn=analyse_pose,
        inputs=gr.Text(),
        outputs=gr.Text(),
        api_name="predict"
    )

demo.launch()
