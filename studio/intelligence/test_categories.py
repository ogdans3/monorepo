"""Model smoke tests: run in intelligence-test with the existing model cache."""
import unittest
from PIL import Image
from server import execute, model, TEXT_MODEL, IMAGE_MODEL
from categories import classify

class CategoryTests(unittest.TestCase):
    def test_actual_multilingual_topics(self):
        examples={
            'New brand identity, logo design, typography and packaging process for a pastry and donut shop.':'merkevare_design',
            'Slik baker du boller. Mel, smør, egg og sukker. Elt deigen og stek i ovnen.':'mat_drikke',
            'Lær trafikkregler og trygg bilkjøring. Bremselengde, vikeplikt og riktig fart.':'bil_transport',
        }
        for text, expected in examples.items():
            with self.subTest(expected=expected):
                result=execute('/categorize',{'text':text})
                self.assertEqual(result['category'],expected)
                self.assertEqual(result['status'],'suggested')
                self.assertEqual(result['basis'],'text')

    def test_missing_content_is_uncertain(self):
        result=execute('/categorize',{'text':'xyz'})
        self.assertEqual(result['category'],'ukategorisert')
        self.assertEqual(result['status'],'uncertain')
        self.assertEqual(result['basis'],'none')
        self.assertIsNone(result['model'])

    def test_blank_video_frame_does_not_invent_topic(self):
        result=classify('',Image.new('RGB',(160,240),'white'),model,TEXT_MODEL,IMAGE_MODEL)
        self.assertEqual(result['category'],'ukategorisert')
        self.assertEqual(result['status'],'uncertain')

if __name__=='__main__':
    unittest.main()
