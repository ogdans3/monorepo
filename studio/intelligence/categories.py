"""Editable suggestions from local semantic/visual similarity, never sales scores."""
CATEGORIES = [
    ('merkevare_design', 'Merkevare og design', 'Brand identity, graphic design, typography, logos, packaging, visual branding and design process.'),
    ('mat_drikke', 'Mat og drikke', 'Food, cooking, recipes, restaurants, pastry, cake, donuts, baking, coffee and drinks.'),
    ('mote_skjonnhet', 'Mote og skjønnhet', 'Fashion, clothes, outfits, makeup, beauty, skincare and hair styling.'),
    ('teknologi', 'Teknologi', 'Technology, software, mobile apps, computers, phones, gadgets and programming.'),
    ('bil_transport', 'Bil og transport', 'Cars, driving, traffic rules, road safety, driving lessons, vehicles and transportation.'),
    ('trening_helse', 'Trening og helse', 'Fitness, exercise, strength training, running, sports, health and wellbeing.'),
    ('reise_natur', 'Reise og natur', 'Travel, holiday, tourism, destinations, landscape, hiking, outdoors and nature.'),
    ('hjem_interior', 'Hjem og interiør', 'Home interior, furniture, architecture, decoration, renovation and home improvement.'),
    ('laering', 'Læring', 'Education, studying, learning, school, exams, explanations and teaching new skills.'),
    ('humor_underholdning', 'Humor og underholdning', 'Comedy, funny jokes, entertainment, memes, dance, music and performance.'),
    ('bedrift_markedsforing', 'Bedrift og markedsføring', 'Business, entrepreneurship, marketing, advertising, sales and starting a company.'),
]


def classify(text, image, get_model, text_model, image_model):
    import numpy as np
    text_scores = np.zeros(len(CATEGORIES))
    image_scores = np.zeros(len(CATEGORIES))
    has_text = len(text.strip()) >= 15
    if not has_text and image is None:
        return {'status':'uncertain','category':'ukategorisert','label':'Ukategorisert',
                'basis':'none','model':None,'similarity':None,'candidates':[]}
    if has_text:
        vectors = get_model(text_model).encode([text[:16000]]+[c[2] for c in CATEGORIES], normalize_embeddings=True)
        text_scores = vectors[1:] @ vectors[0]
    if image is not None:
        model = get_model(image_model)
        vector = model.encode([image], normalize_embeddings=True)[0]
        labels = model.encode(['A video about '+c[2] for c in CATEGORIES], normalize_embeddings=True)
        image_scores = labels @ vector
    scores = text_scores if has_text else image_scores
    order = np.argsort(scores)[::-1]
    best, second = int(order[0]), int(order[1])
    threshold, margin = (.28,.035) if has_text else (.26,.025)
    accepted = (has_text or image is not None) and float(scores[best]) >= threshold and float(scores[best]-scores[second]) >= margin
    # A weak title can still have clear visual evidence, labelled as such.
    basis = 'text' if has_text else 'image'
    if not accepted and image is not None:
        visual_order = np.argsort(image_scores)[::-1]
        first, runner = map(int,visual_order[:2])
        if image_scores[first] >= .27 and image_scores[first]-image_scores[runner] >= .035:
            best, scores, order, accepted, basis = first,image_scores,visual_order,True,'image'
    return {'status':'suggested' if accepted else 'uncertain',
            'category':CATEGORIES[best][0] if accepted else 'ukategorisert',
            'label':CATEGORIES[best][1] if accepted else 'Ukategorisert',
            'basis':basis, 'model':text_model if basis=='text' else image_model,
            'similarity':round(float(scores[best]),4),
            'candidates':[{'category':CATEGORIES[int(i)][0],'label':CATEGORIES[int(i)][1],'similarity':round(float(scores[int(i)]),4)} for i in order[:3]]}
